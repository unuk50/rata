import {
  compareEvents,
  type ExpenseEvent,
  type GroupEvent,
  type PaymentEvent,
  type RataEvent,
} from "./events";
import { allocate, currencyExponent as exp, type Minor } from "./money";

export interface Member {
  mid: string;
  name: string;
}

export interface GroupState {
  group: Omit<GroupEvent, "t" | "id" | "by"> | null;
  members: Member[];
  expenses: ExpenseEvent[];
  payments: PaymentEvent[];
}

/** Fold an unordered list of events into the current group state. */
export function foldEvents(events: RataEvent[]): GroupState {
  const sorted = [...events].sort(compareEvents);
  let group: GroupState["group"] = null;
  const members = new Map<string, Member>();
  const expenses = new Map<string, ExpenseEvent>();
  const payments = new Map<string, PaymentEvent>();
  const seen = new Set<string>();
  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    switch (e.t) {
      case "group":
        group = { name: e.name, currency: e.currency, kind: e.kind, ts: e.ts };
        break;
      case "member":
        members.set(e.mid, { mid: e.mid, name: e.name });
        break;
      case "expense":
        expenses.set(e.eid, e);
        break;
      case "expense.del":
        expenses.delete(e.eid);
        break;
      case "payment":
        payments.set(e.pid, e);
        break;
      case "payment.del":
        payments.delete(e.pid);
        break;
    }
  }
  const byDateDesc = <T extends { date: string; ts: number }>(a: T, b: T) =>
    b.date.localeCompare(a.date) || b.ts - a.ts;
  return {
    group,
    members: [...members.values()],
    expenses: [...expenses.values()].sort(byDateDesc),
    payments: [...payments.values()].sort(byDateDesc),
  };
}

/** What each member owes for one expense, in minor units. Values add up to the amount. */
export function owedShares(e: Pick<ExpenseEvent, "amount" | "split">): Record<string, Minor> {
  const ids = Object.keys(e.split.parts)
    .filter((m) => (e.split.parts[m] ?? 0) > 0)
    .sort();
  if (ids.length === 0) throw new Error("split has no members");
  const weights = ids.map((m) => e.split.parts[m] ?? 0);
  if (e.split.method === "exact") {
    const sum = weights.reduce((a, w) => a + w, 0);
    if (sum !== e.amount) throw new Error("exact parts must add up to the amount");
  }
  if (e.split.method === "percent") {
    const sum = weights.reduce((a, w) => a + w, 0);
    if (sum !== 10000) throw new Error("percent parts must add up to 100%");
  }
  const method = e.split.method === "equal" ? ids.map(() => 1) : weights;
  const parts = allocate(e.amount, method);
  return Object.fromEntries(ids.map((m, i) => [m, parts[i] ?? 0]));
}

/** Validate an expense before it is saved. Returns an error message or null. */
export function validateExpense(e: ExpenseEvent): string | null {
  if (!e.desc.trim()) return "Add a description.";
  if (!Number.isSafeInteger(e.amount) || e.amount <= 0) return "Enter an amount above zero.";
  const paid = Object.values(e.paidBy).reduce((a, v) => a + v, 0);
  if (paid !== e.amount) return "The amounts paid must add up to the total.";
  try {
    owedShares(e);
  } catch (err) {
    return (err as Error).message;
  }
  return null;
}

/** currency -> member id -> net minor units. Positive: the group owes this member. */
export type Balances = Record<string, Record<string, Minor>>;

export function balances(state: Pick<GroupState, "expenses" | "payments">): Balances {
  const out: Balances = {};
  const add = (cur: string, mid: string, v: Minor) => {
    const row = out[cur] ?? {};
    out[cur] = row;
    row[mid] = (row[mid] ?? 0) + v;
  };
  for (const e of state.expenses) {
    for (const [mid, v] of Object.entries(e.paidBy)) add(e.currency, mid, v);
    for (const [mid, v] of Object.entries(owedShares(e))) add(e.currency, mid, -v);
  }
  for (const p of state.payments) {
    add(p.currency, p.from, p.amount);
    add(p.currency, p.to, -p.amount);
  }
  return out;
}

export interface Transfer {
  from: string;
  to: string;
  amount: Minor;
  currency: string;
}

/** Fewest-transfer plan for one currency (greedy: largest debtor pays largest creditor). */
export function simplify(net: Record<string, Minor>, currency: string): Transfer[] {
  const debt = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([m, v]) => ({ m, v: -v }));
  const cred = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([m, v]) => ({ m, v }));
  const out: Transfer[] = [];
  const byAmount = (a: { m: string; v: number }, b: { m: string; v: number }) =>
    b.v - a.v || (a.m < b.m ? -1 : 1);
  while (debt.length && cred.length) {
    debt.sort(byAmount);
    cred.sort(byAmount);
    const d = debt[0];
    const c = cred[0];
    if (!d || !c) break;
    const amount = Math.min(d.v, c.v);
    out.push({ from: d.m, to: c.m, amount, currency });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debt.shift();
    if (c.v === 0) cred.shift();
  }
  return out;
}

/** Rates: units of each currency for 1 EUR (ECB convention). */
export type Rates = Record<string, number>;

/** Convert all balances into one currency. Returns null if a rate is missing. */
export function convertBalances(
  b: Balances,
  target: string,
  rates: Rates,
): Record<string, Minor> | null {
  const out: Record<string, Minor> = {};
  const rate = (c: string) => (c === "EUR" ? 1 : rates[c]);
  const rt = rate(target);
  if (!rt) return null;
  const parts: { mid: string; v: number }[] = [];
  for (const [cur, row] of Object.entries(b)) {
    const rc = rate(cur);
    if (!rc) return null;
    const scale = (rt / rc) * 10 ** (exp(target) - exp(cur));
    for (const [mid, v] of Object.entries(row)) parts.push({ mid, v: v * scale });
  }
  for (const { mid, v } of parts) out[mid] = (out[mid] ?? 0) + v;
  // Round, then move the rounding error to the largest balance so the total stays zero.
  const mids = Object.keys(out).sort();
  const rounded = mids.map((m) => Math.round(out[m] ?? 0));
  const drift = rounded.reduce((a, v) => a + v, 0);
  if (drift !== 0 && mids.length) {
    let big = 0;
    rounded.forEach((v, i) => {
      if (Math.abs(v) > Math.abs(rounded[big] ?? 0)) big = i;
    });
    rounded[big] = (rounded[big] ?? 0) - drift;
  }
  return Object.fromEntries(mids.map((m, i) => [m, rounded[i] ?? 0]));
}

/** Total spend in each currency, and each member's share of it. */
export function spendByMember(state: Pick<GroupState, "expenses">): Balances {
  const out: Balances = {};
  for (const e of state.expenses) {
    const row = out[e.currency] ?? {};
    out[e.currency] = row;
    for (const [mid, v] of Object.entries(owedShares(e))) row[mid] = (row[mid] ?? 0) + v;
  }
  return out;
}
