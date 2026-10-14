#!/usr/bin/env node
// Seed a running Rata server with realistic sample groups.
//
//   node scripts/sample-data/seed.mjs [--base http://localhost:8787] [--out <file.json>]
//
// Prints one invite link per group and writes a JSON file with the links and the
// expected balances (computed here, independently of @rata/core's ledger code).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadCore } from "./core-loader.mjs";
import { GROUPS } from "./data.mjs";

const EXP = { INR: 2, THB: 2, USD: 2, EUR: 2, JPY: 0 };
const toMinor = (v, cur) => Math.round(v * 10 ** (EXP[cur] ?? 2));

// ---------- independent ledger maths (does not use @rata/core) ----------

/** Largest remainder; ties go to the earlier member id in sorted order. */
function share(total, weights) {
  const ids = Object.keys(weights)
    .filter((k) => weights[k] > 0)
    .sort();
  const sum = ids.reduce((a, k) => a + weights[k], 0);
  const out = {};
  let left = total;
  const fr = [];
  for (const k of ids) {
    const exact = (total * weights[k]) / sum;
    out[k] = Math.floor(exact);
    left -= out[k];
    fr.push([k, exact - Math.floor(exact)]);
  }
  fr.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (let i = 0; left > 0; i = (i + 1) % fr.length, left--) out[fr[i][0]] += 1;
  return out;
}

export function expectedBalances(expenses, payments) {
  const bal = {};
  const add = (cur, m, v) => {
    bal[cur] ??= {};
    bal[cur][m] = (bal[cur][m] ?? 0) + v;
  };
  for (const e of expenses) {
    for (const [m, v] of Object.entries(e.paidBy)) add(e.currency, m, v);
    const w =
      e.split.method === "equal"
        ? Object.fromEntries(Object.keys(e.split.parts).map((k) => [k, 1]))
        : e.split.parts;
    for (const [m, v] of Object.entries(share(e.amount, w))) add(e.currency, m, -v);
  }
  for (const p of payments) {
    add(p.currency, p.from, p.amount);
    add(p.currency, p.to, -p.amount);
  }
  return bal;
}

/** Same rule as the app: target units per EUR, round, push drift to the largest balance. */
export function expectedConverted(bal, target, rates) {
  const rate = (c) => (c === "EUR" ? 1 : rates[c]);
  const sum = {};
  for (const [cur, row] of Object.entries(bal)) {
    const scale = (rate(target) / rate(cur)) * 10 ** ((EXP[target] ?? 2) - (EXP[cur] ?? 2));
    for (const [m, v] of Object.entries(row)) sum[m] = (sum[m] ?? 0) + v * scale;
  }
  const ids = Object.keys(sum).sort();
  const r = ids.map((m) => Math.round(sum[m]));
  const drift = r.reduce((a, v) => a + v, 0);
  if (drift) {
    let big = 0;
    r.forEach((v, i) => {
      if (Math.abs(v) > Math.abs(r[big])) big = i;
    });
    r[big] -= drift;
  }
  return Object.fromEntries(ids.map((m, i) => [m, r[i]]));
}

// ---------- event building ----------

function buildGroup(core, def) {
  const { newId } = core;
  const mid = Object.fromEntries(def.members.map((n) => [n, newId()]));
  const all = (list) => (list === "all" ? def.members : list);
  const base = Date.parse(`${def.created}T09:00:00+05:30`);
  const events = [];
  const by = mid[def.members[0]];
  events.push({
    t: "group",
    id: newId(),
    ts: base,
    by,
    name: def.name,
    currency: def.currency,
    kind: def.kind,
  });
  def.members.forEach((n, i) => {
    events.push({ t: "member", id: newId(), ts: base + 1 + i, by, mid: mid[n], name: n });
  });
  const keyed = {};
  const expenses = new Map();
  const payments = [];
  let tick = 0;
  const tsFor = (date) => Date.parse(`${date}T20:00:00+05:30`) + tick++ * 1000;
  let opsTs = 0;

  for (const op of def.ops) {
    if (op.op === "expense" || op.op === "edit") {
      const src = op.op === "edit" ? { ...keyed[op.key].src, ...op.changes } : op;
      const cur = src.cur ?? def.currency;
      const amount = toMinor(src.amount, cur);
      const paidBy =
        typeof src.paid === "string"
          ? { [mid[src.paid]]: amount }
          : Object.fromEntries(Object.entries(src.paid).map(([n, v]) => [mid[n], toMinor(v, cur)]));
      const [method, spec] = Object.entries(src.split)[0];
      let parts;
      if (method === "equal") parts = Object.fromEntries(all(spec).map((n) => [mid[n], 1]));
      else if (method === "exact")
        parts = Object.fromEntries(Object.entries(spec).map(([n, v]) => [mid[n], toMinor(v, cur)]));
      else if (method === "percent")
        parts = Object.fromEntries(
          Object.entries(spec).map(([n, v]) => [mid[n], Math.round(v * 100)]),
        );
      else parts = Object.fromEntries(Object.entries(spec).map(([n, v]) => [mid[n], v]));
      const payerName = typeof src.paid === "string" ? src.paid : Object.keys(src.paid)[0];
      const ts =
        op.op === "edit" ? Math.max(opsTs, keyed[op.key].ev.ts) + 86_400_000 : tsFor(src.date);
      opsTs = Math.max(opsTs, ts);
      const ev = {
        t: "expense",
        id: newId(),
        ts,
        by: mid[payerName],
        eid: op.op === "edit" ? keyed[op.key].ev.eid : newId(),
        desc: src.desc,
        amount,
        currency: cur,
        paidBy,
        split: { method, parts },
        date: src.date,
        ...(src.cat ? { category: src.cat } : {}),
        ...(src.note ? { note: src.note } : {}),
      };
      if (Object.values(paidBy).reduce((a, v) => a + v, 0) !== amount)
        throw new Error(`${def.name}: paid amounts do not add up for ${src.desc}`);
      events.push(ev);
      expenses.set(ev.eid, ev);
      if (src.key || op.key) keyed[src.key ?? op.key] = { src, ev };
    } else if (op.op === "delete") {
      const target = keyed[op.key].ev;
      events.push({
        t: "expense.del",
        id: newId(),
        ts: target.ts + 3_600_000,
        by: target.by,
        eid: target.eid,
      });
      expenses.delete(target.eid);
    } else if (op.op === "payment") {
      const cur = op.cur ?? def.currency;
      const ev = {
        t: "payment",
        id: newId(),
        ts: tsFor(op.date),
        by: mid[op.from],
        pid: newId(),
        from: mid[op.from],
        to: mid[op.to],
        amount: toMinor(op.amount, cur),
        currency: cur,
        date: op.date,
      };
      events.push(ev);
      payments.push(ev);
    }
  }
  const bal = expectedBalances([...expenses.values()], payments);
  const byName = {};
  for (const [cur, row] of Object.entries(bal))
    for (const n of def.members) {
      const v = row[mid[n]] ?? 0;
      if (v === 0) continue;
      byName[n] ??= {};
      byName[n][cur] = v;
    }
  const totals = {};
  for (const e of expenses.values()) totals[e.currency] = (totals[e.currency] ?? 0) + e.amount;
  return {
    events,
    mid,
    expected: {
      balances: bal,
      balancesByName: byName,
      expenseCount: expenses.size,
      paymentCount: payments.length,
      totals,
      expenses: [...expenses.values()].map((e) => ({ eid: e.eid, desc: e.desc })),
    },
  };
}

async function post(base, gid, token, events, core, secret) {
  const sealed = await Promise.all(
    events.map(async (e) => ({ id: e.id, sealed: await core.seal(secret, e) })),
  );
  for (let i = 0; i < sealed.length; i += 200) {
    const res = await fetch(`${base}/api/g/${gid}/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ events: sealed.slice(i, i + 200) }),
    });
    if (!res.ok) throw new Error(`POST failed ${res.status}: ${await res.text()}`);
  }
}

export async function seed({ base = "http://localhost:8787", out } = {}) {
  base = base.replace(/\/$/, "");
  const health = await fetch(`${base}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Rata server is not reachable at ${base}`);
  const core = await loadCore();
  const result = { base, createdAt: new Date().toISOString(), groups: [] };
  for (const def of GROUPS) {
    const secret = core.newGroupSecret();
    // The first authorized POST registers the hash of this token for the group.
    const token = await core.accessToken(secret);
    const built = buildGroup(core, def);
    await post(base, secret.gid, token, built.events, core, secret);
    const invite = `${base}/#/join/${core.encodeInvite(secret)}`;
    result.groups.push({
      slug: def.slug,
      name: def.name,
      kind: def.kind,
      currency: def.currency,
      members: def.members,
      me: def.me,
      gid: secret.gid,
      code: core.encodeInvite(secret),
      invite,
      mid: built.mid,
      eventCount: built.events.length,
      ...built.expected,
    });
    console.log(`${def.name.padEnd(22)} ${built.events.length} events  ${invite}`);
  }
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(`Wrote ${out}`);
  }
  return result;
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed({
    base: arg("base", process.env.RATA_BASE ?? "http://localhost:8787"),
    out: arg("out", ".shots/seed.json"),
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
