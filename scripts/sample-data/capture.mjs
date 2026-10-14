#!/usr/bin/env node
// Walk every Rata user journey on a phone-sized viewport and save screenshots.
//
//   node scripts/sample-data/capture.mjs [--base http://localhost:8787] [--out .shots]
//                                        [--seed <seed.json>] [--notes <notes.json>] [--headed]
//
// Without --seed it first runs seed.mjs against --base, so one command does everything.
// Elements are found by visible text, roles and labels (not CSS classes), so the script keeps
// working after a visual redesign. A step that fails is logged in the manifest and the run goes on.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expectedConverted, seed } from "./seed.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}
const BASE = arg("base", process.env.RATA_BASE ?? "http://localhost:8787").replace(/\/$/, "");
const OUT = arg("out", ".shots");
const HEADED = process.argv.includes("--headed");

function loadPlaywright() {
  const tries = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "/home/claude/node-tools/node_modules/playwright",
    "/opt/node-tools/node_modules/playwright",
  ].filter(Boolean);
  const req = createRequire(import.meta.url);
  for (const t of tries) {
    try {
      return req(t);
    } catch {}
  }
  throw new Error("Playwright not found. Set PLAYWRIGHT_MODULE to its folder.");
}
const { chromium } = loadPlaywright();
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "/opt/pw-browsers";

// Mock rates used for the "rates available" state (units per 1 EUR).
const MOCK_RATES = { EUR: 1, INR: 97.85, THB: 37.92, USD: 1.1642 };

// ---------------------------------------------------------------------------------------------
const manifest = [];
const checks = [];
let n = 0;
let page;
let journey = "setup";

function note(text) {
  const last = manifest[manifest.length - 1];
  if (last) last.observations.push(text);
  console.log(`   note: ${text}`);
}

async function shot(screen, what, { fullPage = false, obs = [] } = {}) {
  n += 1;
  const file = `${String(n).padStart(2, "0")}-${journey}-${screen}.png`;
  if (fullPage) {
    // A full-page capture of a scrolled page draws sticky headers mid-page; start at the top.
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 0);
    });
  }
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, file), fullPage });
  const route = await page.evaluate(() => location.hash || "#/");
  manifest.push({ file, journey, screen, route, what_it_shows: what, observations: [...obs] });
  console.log(`${file}  ${route}`);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    const msg = `STEP FAILED (${journey}/${name}): ${String(e.message)
      .split("\n")
      .filter((l, i) => i === 0 || /intercepts|not enabled|not visible/.test(l))
      .slice(0, 3)
      .join(" | ")}`;
    console.log(`!! ${msg}`);
    manifest.push({
      file: null,
      journey,
      screen: name,
      route: await page.evaluate(() => location.hash).catch(() => ""),
      what_it_shows: "Step could not run",
      observations: [msg],
    });
  }
}

const btn = (name) => page.getByRole("button", { name, exact: typeof name === "string" });
const text = (t) => page.getByText(t, { exact: false }).first();
const goto = async (hash) => {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await page.waitForTimeout(300);
};
const settle = (ms = 600) => page.waitForTimeout(ms);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Format money exactly as the page does (browser locale). */
const fmt = (minor, cur) =>
  page.evaluate(
    ([v, c]) => {
      const f = new Intl.NumberFormat(undefined, { style: "currency", currency: c });
      return f.format(v / 10 ** (f.resolvedOptions().maximumFractionDigits ?? 2));
    },
    [minor, cur],
  );

async function openGroup(name) {
  await goto("/");
  await page
    .getByRole("button", { name: new RegExp(esc(name)) })
    .first()
    .click();
  await waitGroup();
  await page
    .getByText(SYNCED)
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await settle();
}

/** A tab or segmented control option: role "tab" in newer designs, plain button in older ones. */
function choice(name) {
  const re = name instanceof RegExp ? name : new RegExp(`^${esc(name)}$`, "i");
  return page
    .getByRole("tab", { name: re })
    .or(page.getByRole("button", { name: re }))
    .first();
}

async function tab(name) {
  await choice(name).click();
  await settle(300);
}

// ---- Design-agnostic helpers. Each one accepts the labels of the old and the new designs. ----
const GROUP_READY = /^(Expenses)$/i;
const waitGroup = () => choice(GROUP_READY).waitFor({ timeout: 15000 });
const waitJoin = (pg = page) =>
  pg
    .getByText(/^(Who are you\?|Tap your name)$/i)
    .first()
    .waitFor({ timeout: 15000 });
const waitInvite = () => page.getByRole("button", { name: /share link/i }).waitFor();
const waitSettle = () => page.getByRole("button", { name: /save payment/i }).waitFor();
const SYNCED = /^(Live|Synced)$/;

/** The invite-link box on Home may sit behind a "Have an invite link?" button. */
async function inviteBox() {
  const box = page.getByLabel(/invite link/i);
  if (!(await box.isVisible())) await page.getByRole("button", { name: /invite link\?/i }).click();
  return box;
}

/** The "add yourself" name field on Join may sit behind a "Not listed? Add yourself" button. */
async function addSelfField() {
  const old = page.getByLabel(/Add yourself/i);
  if (await old.count()) return old;
  await page.getByRole("button", { name: /add yourself/i }).click();
  return page.getByLabel(/^Your name$/i);
}

/** A settle-plan button: "Mark paid: A to B" (new) or "A paid B" / "Record" (older designs). */
const markPaid = () => page.getByRole("button", { name: /^Mark paid|^Record$|^.+ paid .+$/ });

/**
 * Settle up opens the payment form when you owe someone, otherwise the Balances tab (or is
 * disabled). Returns true when the payment form opened.
 */
async function openSettle() {
  const settleUp = page.getByRole("button", { name: /settle up/i });
  // Newer designs disable Settle up when nothing is open.
  if (await settleUp.isDisabled()) return false;
  await settleUp.click();
  return page
    .getByRole("button", { name: /save payment/i })
    .waitFor({ timeout: 2500 })
    .then(() => true)
    .catch(async (err) => {
      const balances = page.getByRole("tab", { name: "Balances", selected: true });
      if (await balances.count()) return false;
      throw err;
    });
}

/** Date, category and note may sit behind a "More" disclosure. */
async function openMore() {
  if (await page.getByLabel("Category").isVisible()) return;
  await page
    .getByText(/^More$/)
    .first()
    .click();
  await page.getByLabel("Category").waitFor();
}

/** Take one person out of an equal split (checkbox or tap-to-toggle tile). */
async function excludeFromEqual(name) {
  const cb = page.getByRole("checkbox", { name: new RegExp(esc(name)) });
  if (await cb.count()) return cb.uncheck();
  await page
    .getByRole("group", { name: /split/i })
    .getByRole("button", { name, exact: true })
    .click();
}

/** Switch "paid by" to several people (select option or toggle button). */
async function severalPayers() {
  const sel = page.getByRole("combobox", { name: "Paid by" });
  if (await sel.count()) return sel.selectOption({ label: "More than one person" });
  await page.getByRole("button", { name: /several people/i }).click();
}

/** Choose payer or receiver on the payment screen (select or person tiles). */
async function pickPerson(side, name, me) {
  const sel = page.getByRole("combobox", { name: side === "from" ? "Who paid" : "To whom" });
  if (await sel.count()) return sel.selectOption({ label: name });
  await page
    .getByRole("group", { name: side === "from" ? /^(From|Who paid)$/ : /^(To|To whom)$/ })
    .getByRole("button", { name: name === me ? "You" : name, exact: true })
    .click();
}

/**
 * Click a button. If it cannot be reached on screen (for example a fixed bar pushed outside the
 * visible area), note that as a finding and click it from script so the journey can go on.
 */
async function press(loc, what) {
  try {
    await loc.click({ timeout: 4000 });
  } catch (e) {
    const w = await page.evaluate(() => ({
      layout: document.documentElement.scrollWidth,
      screen: window.visualViewport?.width ?? window.innerWidth,
    }));
    note(
      `UNREACHABLE: "${what}" could not be tapped on screen (${String(e.message).split("\n")[0]}).` +
        (w.layout > w.screen
          ? ` The page lays out ${w.layout}px wide on a ${w.screen}px screen.`
          : "") +
        " Clicked from script to continue.",
    );
    await loc.evaluate((el) => el.click());
  }
}

/** Rows in the current tab panel (falls back to every list item). */
async function listRows() {
  const panel = page.getByRole("tabpanel");
  const loc = (await panel.count()) ? panel.locator("li") : page.locator("li");
  return loc.allInnerTexts();
}

/** Inputs in the split list. */
function splitInput(member, method) {
  return page.getByRole("textbox", { name: new RegExp(`^${esc(member)} ${method}`, "i") });
}
function paidInput(member) {
  return page.getByRole("textbox", { name: new RegExp(`^${esc(member)} paid`, "i") });
}

// ------------------------------- number checks ----------------------------------------------

async function checkBalances(g, expectedByName, label, { me = g.me, currencyMode = "per" } = {}) {
  const result = { group: g.name, label, mismatches: [], ok: [] };
  const names = [...g.members, ...(g.extraMembers ?? [])];
  // Read every list item; a plan row is "A pays B <amount>" (text) or has a "<A> paid <B>" button.
  const items = await page.evaluate(() =>
    [...document.querySelectorAll("li")].map((li) => {
      const text = li.innerText;
      const btnLabel = [...li.querySelectorAll("button")]
        .map((b) => b.getAttribute("aria-label") || "")
        .find((l) => /^Mark paid: .+ to .+$|^.+ paid .+$/.test(l));
      return { text, btnLabel: btnLabel ?? null };
    }),
  );
  const isPlan = (it) => / pays /.test(it.text) || it.btnLabel;
  const rows = items.filter((it) => !isPlan(it)).map((it) => it.text);
  const who = (n) => (n === me ? `(${esc(n)}|You)` : esc(n));
  for (const name of names) {
    const row = rows.find((t) => new RegExp(`(^|\\n)${who(name)}( \\(you\\))?(\\n|$)`).test(t));
    const exp = expectedByName[name] ?? {};
    if (!row) {
      result.mismatches.push(`${name}: row not found`);
      continue;
    }
    const flat = row.replace(/\n/g, " ");
    const entries = Object.entries(exp).filter(([, v]) => v !== 0);
    if (entries.length === 0) {
      if (/settled|—/i.test(row)) result.ok.push(`${name}: settled`);
      else result.mismatches.push(`${name}: expected settled, UI shows "${flat}"`);
      continue;
    }
    for (const [cur, v] of entries) {
      const s = await fmt(Math.abs(v), cur);
      const signed = `${v > 0 ? "+" : "−"}${s}`;
      const okDir =
        v > 0
          ? /gets back|owed|receives/i.test(row) || row.includes(signed)
          : /owes|pays/i.test(row) || row.includes(signed);
      if (row.includes(s) && okDir) result.ok.push(`${name}: ${v > 0 ? "+" : "-"}${s}`);
      else
        result.mismatches.push(
          `${name}: expected ${v > 0 ? "gets back" : "owes"} ${s}, UI shows "${flat}"`,
        );
    }
  }
  // Your-balance card (label differs by design).
  const meExp = Object.entries(expectedByName[me] ?? {}).filter(([, v]) => v);
  const card = await page
    .getByText(
      /^\s*(Your balance|You're owed|You owe|All settled|You're settled|Settled|You're square|You are square|Per currency)\b/i,
    )
    .first()
    .locator("xpath=..")
    .innerText()
    .catch(() => "");
  if (meExp.length === 0) {
    if (!/settled|square/i.test(card))
      result.mismatches.push(`Your balance: expected settled, got "${card}"`);
  } else
    for (const [cur, v] of meExp) {
      const s = await fmt(Math.abs(v), cur);
      if (!card.includes(s))
        result.mismatches.push(`Your balance: expected ${s}, got "${card.replace(/\n/g, " ")}"`);
    }
  // Settlement plan must clear all balances.
  const left = {};
  for (const [name, row] of Object.entries(expectedByName))
    for (const [cur, v] of Object.entries(row)) {
      const k = currencyMode === "per" ? cur : "*";
      left[k] ??= {};
      left[k][name] = (left[k][name] ?? 0) + v;
    }
  const curs =
    currencyMode === "per"
      ? [...new Set(Object.values(expectedByName).flatMap(Object.keys))]
      : [g.currency];
  const nameAlt = [...names.map(esc), "You"].join("|");
  const plan = items.filter(isPlan);
  const toName = (n) => (n === "You" ? me : n);
  for (const it of plan) {
    let from;
    let to;
    let candidates;
    if (it.btnLabel) {
      const m = new RegExp(`^(?:Mark paid: )?(${nameAlt}) (?:paid|to) (${nameAlt})$`).exec(
        it.btnLabel,
      );
      if (!m) {
        result.mismatches.push(`plan button not understood: "${it.btnLabel}"`);
        continue;
      }
      [, from, to] = m;
      candidates = it.text.split("\n");
    } else {
      const line = it.text.split("\n")[0];
      const m = new RegExp(`^(${nameAlt}) pays (${nameAlt}) (.+)$`).exec(line);
      if (!m) {
        result.mismatches.push(`plan line not understood: "${line}"`);
        continue;
      }
      [, from, to] = m;
      candidates = [m[3]];
    }
    from = toName(from);
    to = toName(to);
    let matched = false;
    for (const c of candidates.map((x) => x.trim()).filter((x) => /\d/.test(x)))
      for (const cur of curs) {
        if (matched) break;
        const digits = new Intl.NumberFormat("en", {
          style: "currency",
          currency: cur,
        }).resolvedOptions().maximumFractionDigits;
        const num = Math.round(Number(c.replace(/[^\d.]/g, "")) * 10 ** digits);
        if ((await fmt(num, cur)) === c) {
          const k = currencyMode === "per" ? cur : "*";
          left[k] ??= {};
          left[k][from] = (left[k][from] ?? 0) + num;
          left[k][to] = (left[k][to] ?? 0) - num;
          matched = true;
        }
      }
    if (!matched)
      result.mismatches.push(`plan amount not understood: "${it.text.replace(/\n/g, " ")}"`);
  }
  const leftover = Object.entries(left).flatMap(([k, row]) =>
    Object.entries(row)
      .filter(([, v]) => v !== 0)
      .map(([nm, v]) => `${nm} ${k} ${v}`),
  );
  if (leftover.length)
    result.mismatches.push(`plan does not settle everyone: ${leftover.join(", ")}`);
  else result.ok.push(`plan with ${plan.length} payment(s) settles everyone`);
  checks.push(result);
  const msg = result.mismatches.length
    ? `NUMBER CHECK (${label}) mismatches: ${result.mismatches.join("; ")}`
    : `NUMBER CHECK (${label}): all ${result.ok.length} balance lines match the independent calculation.`;
  note(msg);
  return result;
}

// ------------------------------------- run --------------------------------------------------

async function main() {
  if (existsSync(OUT)) for (const f of ["manifest.json"]) rmSync(join(OUT, f), { force: true });
  mkdirSync(OUT, { recursive: true });
  const seedFile = arg("seed");
  const data = seedFile
    ? JSON.parse(readFileSync(seedFile, "utf8"))
    : await seed({ base: BASE, out: join(OUT, "seed.json") });
  const G = Object.fromEntries(data.groups.map((g) => [g.slug, g]));
  const inviteHash = (g) => `/join/${g.code}`;

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    colorScheme: "light",
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  // ---------------------------------------------------------------- 1. first run
  journey = "firstrun";
  await page.goto(`${BASE}/#/`);
  await step("home-empty", async () => {
    await btn("New group").waitFor();
    await settle();
    await shot(
      "home-empty",
      "Home on a new device with no groups: intro card, New group button, invite-link box.",
    );
  });
  await step("new-group", async () => {
    await btn("New group").click();
    await page.getByLabel("Group name").waitFor();
    await shot(
      "new-group-empty",
      "New group form before typing: name, event type, main currency, your name, other people.",
    );
    await page.getByLabel("Group name").fill("Alibaug weekend");
    await page.getByRole("button", { name: /^Trip/ }).click();
    await page.getByLabel(/^(Main currency|Currency)$/).selectOption("INR");
    await page.getByLabel(/^(Your name|You)$/).fill("Aarav");
    await page.getByLabel(/^(Other people|People)/).fill("Rohan, Meera, Siddharth");
    const addP = page.getByRole("button", { name: "Add person" });
    if ((await addP.count()) && (await addP.isEnabled())) await addP.click();
    await shot(
      "new-group-filled",
      "New group form filled in: trip in INR with Aarav and three friends.",
    );
    await btn("Create group").click();
    await waitInvite();
    await settle(800);
    await shot(
      "invite",
      "Invite screen right after creating a group: the invite link, Share and Copy buttons, key explanation.",
    );
    await page.getByRole("button", { name: /^Copy( link)?$/ }).click();
    await shot("invite-copied", "Invite screen after pressing Copy.");
    await page.getByRole("button", { name: /^(Go to the group|Done)$/ }).click();
    await waitGroup();
    await settle(1500);
    await shot(
      "group-empty",
      "A brand-new group with no expenses: balance card, tabs, empty state, bottom buttons.",
    );
    await tab("balances");
    await shot("group-empty-balances", "Balances tab of a new group with no expenses.");
  });

  // ---------------------------------------------------------------- 2. join
  journey = "join";
  await step("invalid-links", async () => {
    await goto("/");
    await (await inviteBox()).fill("https://rata.example/hello");
    await btn("Join").click();
    await shot(
      "home-invalid-link",
      "Home after pasting text that is not an invite link and pressing Join.",
    );
    await goto("/join/not-a-real-code");
    await shot("join-broken-link", "Opening a broken invite link (#/join/not-a-real-code).");
    const fake = `${"A".repeat(21)}x.${"B".repeat(42)}y`;
    await goto(`/join/${fake}`);
    await settle(6000);
    const t = await page.locator("body").innerText();
    await shot(
      "join-unknown-group",
      "Opening a well-formed invite link for a group that does not exist, after waiting 6 seconds.",
      {
        obs: /Opening/.test(t)
          ? [
              "Still shows 'Opening…' after 6 s: a link to a group that does not exist (or a wrong key) spins forever; the 'empty or wrong link' message is never reached while online.",
            ]
          : [],
      },
    );
  });
  await step("join-paste", async () => {
    await goto("/");
    await (await inviteBox()).fill(G.flat.invite);
    await btn("Join").click();
    await waitJoin();
    await settle(800);
    await shot(
      "join-who-are-you",
      `Join screen for "${G.flat.name}" opened by pasting the link on Home: pick yourself or add a new name.`,
    );
    await btn(G.flat.me).click();
    await waitGroup();
    await settle(1200);
  });
  await step("join-links", async () => {
    for (const slug of ["goa", "bangkok", "lonavala"]) {
      const g = G[slug];
      await goto(inviteHash(g));
      await waitJoin();
      await settle(500);
      if (slug === "goa")
        await shot(
          "join-who-are-you-6",
          "Join screen for the 6-person Goa trip opened from the invite link.",
        );
      await btn(g.me).click();
      await waitGroup();
      await settle(500);
    }
  });
  await step("join-add-self", async () => {
    const g = G.party;
    await goto(inviteHash(g));
    await waitJoin();
    await settle(500);
    await (await addSelfField()).fill("Dev");
    await shot(
      "join-add-self",
      "Join screen for an 8-person party, typing a new name after 'Not listed? Add yourself'.",
      { fullPage: true },
    );
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await waitGroup();
    await settle(1000);
    g.me = "Dev";
    g.extraMembers = ["Dev"];
  });
  await step("home-groups", async () => {
    await goto("/");
    await settle(500);
    await shot("home-groups", "Home with six groups on this device (most recently added first).", {
      fullPage: true,
    });
  });

  // ---------------------------------------------------------------- 3. group screens + number checks
  journey = "group";
  await step("flat", async () => {
    const g = G.flat;
    await openGroup(g.name);
    await shot(
      "flat-expenses",
      "Flat 4B group, Expenses tab, top of the list: balance card, sync status, latest expenses.",
    );
    await page.mouse.wheel(0, 2400);
    await shot(
      "flat-expenses-scrolled",
      "Flat 4B expense list scrolled down (shows payment rows between expenses and the fixed bottom bar).",
    );
    await page.mouse.wheel(0, -10000);
    await shot(
      "flat-expenses-full",
      `Full Flat 4B expense list (${g.expenseCount} expenses, ${g.paymentCount} payments).`,
      { fullPage: true },
    );
    const items = (await listRows()).filter((t) => /\d/.test(t));
    if (items.length !== g.expenseCount + g.paymentCount)
      note(`List shows ${items.length} rows, expected ${g.expenseCount + g.paymentCount}.`);
    else note(`List row count OK (${items.length}).`);
    await tab("balances");
    await shot(
      "flat-balances",
      "Flat 4B Balances tab: net balance per person and the fewest payments to settle.",
    );
    await checkBalances(g, g.balancesByName, "Flat 4B");
  });
  await step("goa", async () => {
    const g = G.goa;
    await openGroup(g.name);
    await shot("goa-expenses", "Goa trip Expenses tab (6 people).");
    await shot(
      "goa-expenses-full",
      `Full Goa expense list (${g.expenseCount} expenses, ${g.paymentCount} payments, one deleted duplicate taxi not shown).`,
      { fullPage: true },
    );
    const items = (await listRows()).filter((t) => /\d/.test(t));
    if (items.length !== g.expenseCount + g.paymentCount)
      note(`List shows ${items.length} rows, expected ${g.expenseCount + g.paymentCount}.`);
    else note(`List row count OK (${items.length}); deleted duplicate taxi is hidden.`);
    await tab("balances");
    await shot("goa-balances", "Goa trip balances and suggested payments.", { fullPage: true });
    await checkBalances(g, g.balancesByName, "Goa trip");
  });
  await step("bangkok", async () => {
    const g = G.bangkok;
    await openGroup(g.name);
    await shot(
      "bangkok-expenses",
      "Bangkok trip expenses in INR, THB, USD and EUR. Exchange rates are not available offline.",
      { fullPage: true },
    );
    await tab("balances");
    await shot(
      "bangkok-balances-norates",
      "Bangkok balances when /api/rates fails: one line per currency per person and a plan per currency.",
      { fullPage: true },
    );
    await checkBalances(g, g.balancesByName, "Bangkok, no rates (per currency)");
  });
  await step("bangkok-rates", async () => {
    const g = G.bangkok;
    await page.route("**/api/rates", (r) =>
      r.fulfill({ json: { base: "EUR", date: "2026-10-13", rates: MOCK_RATES } }),
    );
    await page.reload();
    await openGroup(g.name);
    await shot(
      "bangkok-expenses-rates",
      "Bangkok trip with (mocked) ECB rates available: balance card converted to INR.",
    );
    await tab("balances");
    await shot(
      "bangkok-balances-rates",
      "Bangkok balances converted to INR at mocked ECB rates, one plan in INR.",
      { fullPage: true },
    );
    const conv = expectedConverted(
      Object.fromEntries(
        Object.entries(g.balances).map(([c, row]) => [
          c,
          Object.fromEntries(
            Object.entries(row).map(([mid, v]) => [g.members.find((nm) => g.mid[nm] === mid), v]),
          ),
        ]),
      ),
      "INR",
      MOCK_RATES,
    );
    const byName = Object.fromEntries(
      Object.entries(conv).map(([nm, v]) => [nm, v ? { INR: v } : {}]),
    );
    await checkBalances(g, byName, "Bangkok, converted to INR", { currencyMode: "one" });
    await page.unroute("**/api/rates");
    await page.evaluate(() => localStorage.removeItem("rata.rates"));
    await page.reload();
    await settle(800);
  });
  await step("party", async () => {
    const g = G.party;
    await openGroup(g.name);
    await shot(
      "party-expenses",
      "Party group as Dev, a new member who joined via the link and is in none of the expenses.",
    );
    await tab("balances");
    await shot("party-balances", "Party balances for 9 people (8 original + Dev).", {
      fullPage: true,
    });
    await checkBalances(g, g.balancesByName, "Ganpati party");
  });
  await step("lonavala", async () => {
    const g = G.lonavala;
    await openGroup(g.name);
    await shot("settled-expenses", "Small group that is fully settled: 3 expenses and 2 payments.");
    await tab("balances");
    await shot(
      "settled-balances",
      "Fully settled group: everyone 'settled', no payments suggested.",
    );
    await checkBalances(g, g.balancesByName, "Lonavala (settled)");
  });

  // ---------------------------------------------------------------- 4. add expense
  journey = "add";
  const openAdd = async () => {
    await page.getByRole("button", { name: /add expense/i }).click();
    await page.getByLabel("Description").waitFor();
    await settle(400);
  };
  await step("validation", async () => {
    await openGroup(G.flat.name);
    await openAdd();
    await shot(
      "form-empty",
      "Add expense form for the 3-person flat, untouched (equal split, all ticked).",
      { fullPage: true },
    );
    await press(btn("Save"), "Save");
    await shot("error-no-amount", "Pressing Save on an empty form.", { fullPage: true });
    await page.getByLabel("Amount", { exact: true }).fill("1200");
    await press(btn("Save"), "Save");
    await shot("error-no-description", "Amount filled but no description, Save pressed.", {
      fullPage: true,
    });
    await page.getByLabel("Amount", { exact: true }).fill("12.345");
    await page.getByLabel("Description").fill("Test");
    await press(btn("Save"), "Save");
    await shot("error-bad-amount", "Amount with three decimals (12.345) in INR, Save pressed.", {
      fullPage: true,
    });
  });
  await step("equal", async () => {
    await page.getByLabel("Description").fill("Chai & samosa for society meeting");
    await page.getByLabel("Amount", { exact: true }).fill("1,200");
    await openMore();
    await page.getByLabel("Category").selectOption("Food");
    await excludeFromEqual("Rohan");
    await page.getByLabel(/^Note/).fill("Rohan was travelling");
    await shot(
      "equal-subset",
      "Equal split with Rohan unticked: preview shows ₹600 each for Aarav and Priya.",
      { fullPage: true },
    );
    await press(btn("Save"), "Save");
    await waitGroup();
  });
  await step("exact", async () => {
    await openAdd();
    await page.getByLabel("Description").fill("Croma – extension boards & bulbs");
    await page.getByLabel("Amount", { exact: true }).fill("2499");
    await choice(/^(Amounts|Exact)$/).click();
    await splitInput("Aarav", "exact").fill("1000");
    await splitInput("Priya", "exact").fill("1000");
    await splitInput("Rohan", "exact").fill("400");
    await shot(
      "exact-mismatch",
      "Split by exact amounts that add up to ₹2,400 of ₹2,499 (running total shown in red).",
      { fullPage: true },
    );
    await press(btn("Save"), "Save");
    await shot("exact-error", "Save pressed with exact amounts that do not add up.", {
      fullPage: true,
    });
    await splitInput("Rohan", "exact").fill("499");
    await shot("exact-ok", "Exact amounts fixed (₹1,000 + ₹1,000 + ₹499).", { fullPage: true });
    await press(btn("Save"), "Save");
    await waitGroup();
  });
  await step("percent", async () => {
    await openAdd();
    await page.getByLabel("Description").fill("Netflix Premium – yearly");
    await page.getByLabel("Amount", { exact: true }).fill("7788");
    await openMore();
    await page.getByLabel("Category").selectOption("Fun");
    await choice(/^(Percent|%)$/).click();
    await splitInput("Aarav", "percent").fill("50");
    await splitInput("Priya", "percent").fill("30");
    await splitInput("Rohan", "percent").fill("10");
    await press(btn("Save"), "Save");
    await shot("percent-error", "Percent split adding up to 90%, Save pressed.", {
      fullPage: true,
    });
    await splitInput("Aarav", "percent").fill("33.33");
    await splitInput("Priya", "percent").fill("33.33");
    await splitInput("Rohan", "percent").fill("33.34");
    const t = await page.locator("body").innerText();
    await shot("percent-ok", "Percent split 33.33 / 33.33 / 33.34 with the running total.", {
      fullPage: true,
      obs: /99\.9999|100\.0000/.test(t)
        ? ["Running percent total shows a floating-point artefact instead of 100%."]
        : [],
    });
    await press(btn("Save"), "Save");
    await waitGroup();
  });
  await step("shares", async () => {
    await openAdd();
    await page.getByLabel("Description").fill("Groceries for house party");
    await page.getByLabel("Amount", { exact: true }).fill("2700");
    await openMore();
    await page.getByLabel("Category").selectOption("Groceries");
    await choice("Shares").click();
    await splitInput("Aarav", "shares").fill("2");
    await splitInput("Priya", "shares").fill("1");
    await splitInput("Rohan", "shares").fill("1.5");
    await press(btn("Save"), "Save");
    await shot("shares-error", "Shares with a fractional value (1.5), Save pressed.", {
      fullPage: true,
    });
    await splitInput("Rohan", "shares").fill("1");
    await shot("shares-ok", "Shares 2 / 1 / 1 with the per-person preview.", { fullPage: true });
    await press(btn("Save"), "Save");
    await waitGroup();
  });
  await step("multi-payer", async () => {
    await openAdd();
    await page.getByLabel("Description").fill("Diwali lights & diyas");
    await page.getByLabel("Amount", { exact: true }).fill("3000");
    await openMore();
    await page.getByLabel("Category").selectOption("Shopping");
    await severalPayers();
    await paidInput("Aarav").fill("2000");
    await paidInput("Priya").fill("500");
    await press(btn("Save"), "Save");
    await shot(
      "multi-payer-error",
      "Two payers whose amounts (₹2,500) do not match the total ₹3,000, Save pressed.",
      { fullPage: true },
    );
    await paidInput("Priya").fill("1000");
    await shot("multi-payer-ok", "Two payers fixed: Aarav ₹2,000 + Priya ₹1,000, split equally.", {
      fullPage: true,
    });
    await press(btn("Save"), "Save");
    await waitGroup();
    await settle(800);
    await shot("flat-after-adds", "Flat 4B list after adding five expenses through the form.");
  });
  await step("foreign", async () => {
    await openGroup(G.bangkok.name);
    await openAdd();
    await page.getByLabel("Description").fill("Mango sticky rice at Mae Varee");
    await page.getByLabel("Currency").selectOption("THB");
    await page.getByLabel("Amount", { exact: true }).fill("480");
    await openMore();
    await page.getByLabel("Category").selectOption("Food");
    await shot("foreign-thb", "Adding an expense in Thai baht in an INR group; preview in THB.", {
      fullPage: true,
    });
    await press(btn("Save"), "Save");
    await waitGroup();
    await openAdd();
    await page.getByLabel("Description").fill("Hotel minibar (JPY test)");
    await page.getByLabel("Currency").selectOption("JPY");
    await page.getByLabel("Amount", { exact: true }).fill("1500");
    await shot(
      "foreign-jpy",
      "Currency with no decimals (JPY): placeholder and preview formatting.",
      { fullPage: true },
    );
    await page.getByRole("button", { name: "Back" }).click();
    await settle(500);
    await shot("bangkok-after-add", "Bangkok list after adding a THB expense.");
  });

  // ---------------------------------------------------------------- 5. edit + delete
  journey = "edit";
  await step("edit-villa", async () => {
    await openGroup(G.goa.name);
    await page.getByText("Villa in Anjuna", { exact: false }).first().click();
    await page.getByLabel("Description").waitFor();
    await settle(500);
    await shot(
      "villa-multi-payer-shares",
      "Editing the villa: two payers (Kabir ₹30,000 + Vikram ₹24,000) and split by shares.",
      { fullPage: true },
    );
    await page.getByRole("button", { name: "Back" }).click();
  });
  await step("edit-percent", async () => {
    await page.getByText("Drinks at Tito", { exact: false }).first().click();
    await page.getByLabel("Description").waitFor();
    await settle(500);
    await shot("tito-percent", "Editing a percent split expense (20/10/25/10/25/10).", {
      fullPage: true,
    });
    await page.getByRole("button", { name: "Back" }).click();
  });
  await step("edit-save", async () => {
    await page.getByText("Bottled water & snacks", { exact: false }).first().click();
    await page.getByLabel("Description").waitFor();
    await settle(400);
    await page.getByLabel("Amount", { exact: true }).fill("520");
    await openMore();
    await page.getByLabel(/^Note/).fill("Added 2 more bottles");
    await shot("water-edit", "Changing the amount of an equal-split expense from ₹486 to ₹520.", {
      fullPage: true,
    });
    await press(btn("Save"), "Save");
    await waitGroup();
    await shot("after-edit", "Goa list after editing the water expense.");
  });
  await step("delete", async () => {
    const eid = G.goa.expenses.find((e) => e.desc.startsWith("Bebinca"))?.eid;
    await page.getByText("Bebinca for office", { exact: false }).first().click();
    await page.getByLabel("Description").waitFor();
    await settle(400);
    await shot(
      "bebinca-before-delete",
      "Edit screen of an expense about to be deleted (Delete in the header).",
      { fullPage: true },
    );
    const before = dialogs.length;
    await btn("Delete").click();
    await waitGroup();
    await shot(
      "after-delete",
      "Goa list after deleting 'Bebinca for office' (the browser confirm dialog was accepted).",
      {
        obs:
          dialogs.length > before
            ? [
                `Confirm dialog text: "${dialogs[dialogs.length - 1]}" (native dialog, not in screenshot).`,
              ]
            : [],
      },
    );
    await goto(`/g/${G.goa.gid}/e/${eid}`);
    await settle(800);
    await shot("deleted-expense-url", "Opening the link of a deleted expense.");
  });

  // ---------------------------------------------------------------- 6. settle up
  journey = "settle";
  await step("from-plan", async () => {
    await openGroup(G.goa.name);
    await tab("balances");
    await shot(
      "goa-balances-before",
      "Goa balances after the edit and delete, with suggested payments.",
      { fullPage: true },
    );
    await markPaid().first().click();
    await waitSettle();
    await settle(500);
    await shot(
      "record-prefilled",
      "Record a payment, prefilled from the first suggested payment (Mark paid).",
    );
    await press(btn("Save payment"), "Save payment");
    await waitGroup();
    await settle(500);
    await shot("goa-after-payment", "Goa expenses list with the new payment row on top.");
    await tab("balances");
    await shot("goa-balances-after", "Goa balances after recording one suggested payment.", {
      fullPage: true,
    });
  });
  await step("blank-form", async () => {
    await openGroup(G.lonavala.name);
    const obs = [];
    if (!(await openSettle())) {
      // Newer design: with nothing to pay, Settle up shows Balances. The blank form has no button.
      obs.push(
        "Settle up on a settled group opens the Balances tab, not a form; this blank form was opened by its URL (#/g/<id>/settle).",
      );
      await goto(`/g/${G.lonavala.gid}/settle`);
      await waitSettle();
    }
    await settle(500);
    const cur = await page.getByLabel("Currency").inputValue();
    if (cur !== "INR") obs.push(`Currency defaults to ${cur}, not the group currency INR.`);
    await shot("blank-form", "Empty payment form on a settled INR group.", { obs });
    await press(btn("Save payment"), "Save payment");
    await shot("error-no-amount", "Save payment with no amount.");
    await pickPerson("from", "Kabir", G.lonavala.me);
    await pickPerson("to", "Rohan", G.lonavala.me);
    await page.getByLabel("Amount").fill("250");
    await shot("blank-filled", "Payment Kabir → Rohan 250 with the default currency left as is.");
    await press(btn("Save payment"), "Save payment");
    await waitGroup();
    await tab("balances");
    await shot(
      "settled-group-after-payment",
      "The previously settled group after recording that payment.",
      { fullPage: true },
    );
  });

  // ---------------------------------------------------------------- 7. settings
  journey = "settings";
  await step("settings", async () => {
    await openGroup(G.flat.name);
    await page.getByRole("button", { name: /group settings/i }).click();
    await text("People").waitFor();
    await settle(500);
    const v = await page.getByLabel("Group name").inputValue();
    await shot(
      "flat-settings",
      "Group settings: name, main currency and total spent, people, invite, CSV export, remove.",
      {
        fullPage: true,
        obs: v
          ? []
          : ["Group name field is empty when the screen opens (it should show the current name)."],
      },
    );
    await page.getByLabel("Group name").fill("Flat 4B, Bandra West");
    const saveName = page.getByRole("button", { name: "Save", exact: true });
    if (await saveName.count()) await saveName.click();
    else await page.getByLabel("Group name").press("Enter");
    await settle(800);
    await page.getByLabel(/new person/i).fill("Kunal");
    await page.getByRole("button", { name: /^(Add|Add person)$/ }).click();
    await settle(800);
    await shot(
      "renamed-and-added",
      "After renaming the group and adding Kunal as a fourth flatmate.",
      { fullPage: true },
    );
    const [dl] = await Promise.all([page.waitForEvent("download"), btn("Export CSV").click()]);
    const csvPath = join(OUT, `export-${dl.suggestedFilename()}`);
    await dl.saveAs(csvPath);
    const csv = readFileSync(csvPath, "utf8").trim().split("\n");
    note(`CSV export saved as ${csvPath}: ${csv.length - 1} data rows, header: ${csv[0]}`);
    if (await btn("Invite link").count()) {
      await btn("Invite link").click();
      await waitInvite();
      await shot(
        "invite-from-settings",
        "Invite screen opened from settings for an existing group.",
      );
      await page.getByRole("button", { name: "Back" }).click();
    } else {
      note("Settings has no 'Invite link' button in this design (invite is in the group header).");
      await page.getByRole("button", { name: "Back" }).click();
    }
    await waitGroup();
    await shot("group-after-rename", "Group screen after renaming (header shows the new name).");
    await goto("/");
    await shot("home-after-rename", "Home after renaming Flat 4B.");
  });
  await step("leave", async () => {
    await openGroup("Alibaug weekend");
    await page.getByRole("button", { name: /group settings/i }).click();
    await text("People").waitFor();
    await settle(400);
    await shot(
      "alibaug-settings",
      "Settings of the small group created in the first-run journey.",
      { fullPage: true },
    );
    await btn("Remove from this device").click();
    await btn("New group").waitFor();
    await settle(500);
    await shot(
      "home-after-remove",
      "Home after removing the Alibaug group from this device (confirm dialog accepted).",
      {
        obs: [
          `Confirm dialog text: "${dialogs[dialogs.length - 1]}" (native dialog, not in screenshot).`,
        ],
      },
    );
    await goto(`/g/${"Z".repeat(22)}`);
    await settle(400);
    await shot(
      "group-not-on-device",
      "Opening a group link (#/g/<id>) for a group that is not on this device.",
    );
  });

  // ---------------------------------------------------------------- 8. offline
  journey = "offline";
  await step("offline", async () => {
    try {
      await openGroup(G.goa.name);
      await ctx.setOffline(true);
      await page
        .getByText(/^Offline/)
        .first()
        .waitFor({ timeout: 15000 })
        .catch(() => {});
      await settle(800);
      await shot("group-offline", "Goa group after the network drops: status shows Offline.");
      await openAdd();
      await page.getByLabel("Description").fill("Auto rickshaw to station");
      await page.getByLabel("Amount", { exact: true }).fill("180");
      await press(btn("Save"), "Save");
      await waitGroup();
      await settle(600);
      await shot(
        "added-offline",
        "Expense added while offline: it shows in the list and the status shows 1 change waiting.",
      );
    } finally {
      await ctx.setOffline(false);
    }
    await page
      .getByText(SYNCED)
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => {});
    await settle(1000);
    await shot(
      "back-online",
      "Back online: the waiting change is sent and status returns to Live.",
    );
  });
  await step("offline-join", async () => {
    await page.reload();
    await settle(800);
    await ctx.setOffline(true);
    try {
      // A group that was never opened on this device.
      const code = `${"C".repeat(21)}q.${"D".repeat(42)}r`;
      await goto(`/join/${code}`);
      await settle(1500);
      await shot(
        "join-offline",
        "Opening an invite link while offline for a group not yet on this device.",
      );
    } finally {
      await ctx.setOffline(false);
    }
    await settle(1500);
  });

  // ---------------------------------------------------------------- 9. dark mode
  journey = "dark";
  await step("dark", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await goto("/");
    await settle(500);
    await shot("home", "Home in dark mode.");
    await openGroup("Goa trip");
    await shot("goa-expenses", "Goa expenses in dark mode.");
    await tab("balances");
    await shot("goa-balances", "Goa balances in dark mode.", { fullPage: true });
    await openAdd();
    await choice(/^(Percent|%)$/).click();
    await shot("add-expense", "Add expense form in dark mode (percent split).", { fullPage: true });
    await page.getByRole("button", { name: "Back" }).click();
    await waitGroup();
    if (!(await openSettle())) {
      await markPaid().first().click();
      await waitSettle();
    }
    await shot("settle", "Record a payment in dark mode.");
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: /group settings/i }).click();
    await text("People").waitFor();
    await shot("settings", "Group settings in dark mode.", { fullPage: true });
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await shot("invite", "Invite screen in dark mode.");
    await page.emulateMedia({ colorScheme: "light" });
  });

  // ---------------------------------------------------------------- 10. installed app offline reload
  journey = "pwa";
  await step("pwa-offline-reload", async () => {
    const ctx2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
    });
    const prev = page;
    try {
      const p2 = await ctx2.newPage();
      await p2.goto(`${BASE}/${inviteHash(G.lonavala).replace(/^\//, "#/")}`);
      await waitJoin(p2);
      await p2.getByRole("button", { name: "Aarav", exact: true }).click();
      await p2
        .getByRole("tab", { name: "Expenses" })
        .or(p2.getByRole("button", { name: "Expenses" }))
        .first()
        .waitFor();
      await p2.evaluate(() => navigator.serviceWorker?.ready);
      await p2.reload();
      await p2.waitForTimeout(1500);
      await ctx2.setOffline(true);
      let reloaded = true;
      await p2.reload().catch(() => {
        reloaded = false;
      });
      await p2.waitForTimeout(2000);
      page = p2;
      await shot(
        "offline-reload",
        "Fresh device with the service worker installed, page reloaded with no network.",
        {
          obs: reloaded ? [] : ["Reload failed while offline (no cached app shell)."],
        },
      );
    } finally {
      page = prev;
      await ctx2.close();
    }
  });

  // ---------------------------------------------------------------- 11. screens added later
  // New in later designs; kept at the end so the numbers above match earlier rounds.
  journey = "extra";
  await step("settle-up-no-debt", async () => {
    await openGroup(G.lonavala.name);
    const hero = await page.locator("main").innerText();
    const disabled = await page.getByRole("button", { name: /settle up/i }).isDisabled();
    const opened = await openSettle();
    await settle(400);
    await shot(
      "settle-up-no-debt",
      "Lonavala (you owe nobody, one payment open between others): what Settle up opens.",
      {
        obs: [
          disabled
            ? "Settle up is disabled (nothing to pay)."
            : opened
              ? "Settle up opened the payment form."
              : "Settle up opened the Balances tab (you have nothing to pay).",
          ...(/payments? open/i.test(hero)
            ? ["Hero shows 'You're square' with payments open."]
            : []),
        ],
      },
    );
  });
  await step("payment-edit-delete", async () => {
    await openGroup(G.goa.name);
    await page
      .getByRole("tabpanel")
      .getByText(/^(paid|payment)$/i)
      .first()
      .click();
    await page.getByRole("button", { name: /save payment/i }).waitFor();
    await settle(500);
    const route = await page.evaluate(() => location.hash);
    await page.getByLabel("Amount").fill("1000");
    await shot(
      "payment-edit",
      "Edit payment (#/g/<id>/p/<pid>) opened from a payment row, amount changed to ₹1,000; Delete in the header.",
    );
    await press(btn("Save payment"), "Save payment");
    await waitGroup();
    await settle(500);
    await shot("after-payment-edit", "Goa list after editing the payment.");
    await goto(route.replace(/^#/, ""));
    await page.getByRole("button", { name: /save payment/i }).waitFor();
    await settle(400);
    const before = dialogs.length;
    await btn("Delete").click();
    await waitGroup();
    await settle(500);
    await shot("after-payment-delete", "Goa list after deleting that payment.", {
      obs:
        dialogs.length > before
          ? [`Confirm dialog text: "${dialogs[dialogs.length - 1]}" (native dialog).`]
          : [],
    });
    await goto(route.replace(/^#/, ""));
    await settle(800);
    await shot("deleted-payment-url", "Opening the link of a deleted payment.");
  });

  if (consoleErrors.length)
    manifest.push({
      file: null,
      journey: "console",
      screen: "errors",
      route: "",
      what_it_shows: "Browser console errors seen during the run",
      observations: [...new Set(consoleErrors)].slice(0, 30),
    });

  // Optional hand-written notes keyed by screen file suffix, e.g. {"group-flat-balances": ["..."]}.
  const notesFile = arg("notes");
  if (notesFile && existsSync(notesFile)) {
    const notes = JSON.parse(readFileSync(notesFile, "utf8"));
    for (const m of manifest) {
      const key = m.file ? m.file.replace(/^\d+-/, "").replace(/\.png$/, "") : null;
      if (key && notes[key]) m.observations.push(...notes[key]);
    }
  }
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 2));
  await browser.close();
  const shots = manifest.filter((m) => m.file).length;
  const failed = manifest.filter((m) => !m.file && m.journey !== "console").length;
  console.log(
    `\n${shots} screenshots, ${failed} failed steps. Manifest: ${join(OUT, "manifest.json")}`,
  );
  for (const c of checks)
    console.log(
      `check ${c.label}: ${c.mismatches.length ? `MISMATCH ${c.mismatches.join("; ")}` : "OK"}`,
    );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
