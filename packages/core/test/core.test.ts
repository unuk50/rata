import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  allocate,
  balances,
  convertBalances,
  type ExpenseEvent,
  foldEvents,
  owedShares,
  parseAmount,
  type RataEvent,
  simplify,
} from "../src";

const members = ["a", "b", "c", "d"];

const expenseArb = fc
  .record({
    amount: fc.integer({ min: 1, max: 10_000_000 }),
    payer: fc.constantFrom(...members),
    method: fc.constantFrom("equal", "shares", "percent") as fc.Arbitrary<
      "equal" | "shares" | "percent"
    >,
    in: fc.subarray(members, { minLength: 1 }),
    weights: fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 4, maxLength: 4 }),
    currency: fc.constantFrom("USD", "EUR", "INR", "JPY"),
    eid: fc.uuid(),
  })
  .map((r): ExpenseEvent => {
    let parts: Record<string, number>;
    if (r.method === "percent") {
      const bp = allocate(
        10000,
        r.in.map(() => 1),
      );
      parts = Object.fromEntries(r.in.map((m, i) => [m, bp[i] ?? 0]));
    } else {
      parts = Object.fromEntries(
        r.in.map((m, i) => [m, r.method === "equal" ? 1 : (r.weights[i] ?? 1)]),
      );
    }
    return {
      t: "expense",
      id: r.eid,
      ts: 1,
      eid: r.eid,
      desc: "x",
      amount: r.amount,
      currency: r.currency,
      paidBy: { [r.payer]: r.amount },
      split: { method: r.method, parts },
      date: "2026-10-14",
    };
  });

describe("allocate", () => {
  it("parts always add up to the total", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e9, max: 1e9 }),
        fc
          .array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 12 })
          .filter((w) => w.some((x) => x > 0)),
        (total, weights) => {
          const parts = allocate(total, weights);
          expect(parts.reduce((a, p) => a + p, 0)).toBe(total);
          weights.forEach((w, i) => {
            if (w === 0) expect(parts[i]).toBe(0);
          });
        },
      ),
    );
  });
  it("splits 100.00 three ways as 33.34, 33.33, 33.33", () => {
    expect(allocate(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });
});

describe("balances", () => {
  it("each currency adds up to zero", () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 30 }), (expenses) => {
        const b = balances({ expenses, payments: [] });
        for (const row of Object.values(b)) {
          expect(Object.values(row).reduce((a, v) => a + v, 0)).toBe(0);
        }
      }),
    );
  });
  it("owed shares add up to the amount", () => {
    fc.assert(
      fc.property(expenseArb, (e) => {
        const s = Object.values(owedShares(e)).reduce((a, v) => a + v, 0);
        expect(s).toBe(e.amount);
      }),
    );
  });
  it("simplified transfers settle every balance", () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { minLength: 1, maxLength: 30 }), (expenses) => {
        const b = balances({ expenses, payments: [] });
        for (const [cur, row] of Object.entries(b)) {
          const after = { ...row };
          const plan = simplify(row, cur);
          expect(plan.length).toBeLessThanOrEqual(Math.max(0, Object.keys(row).length - 1));
          for (const t of plan) {
            after[t.from] = (after[t.from] ?? 0) + t.amount;
            after[t.to] = (after[t.to] ?? 0) - t.amount;
          }
          for (const v of Object.values(after)) expect(v).toBe(0);
        }
      }),
    );
  });
  it("converted balances add up to zero", () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 20 }), (expenses) => {
        const b = balances({ expenses, payments: [] });
        const c = convertBalances(b, "INR", { USD: 1.08, INR: 90.5, JPY: 160.2 });
        expect(c).not.toBeNull();
        expect(Object.values(c ?? {}).reduce((a, v) => a + v, 0)).toBe(0);
      }),
    );
  });
});

describe("foldEvents", () => {
  it("is the same in any order, and a later edit wins", () => {
    const evs: RataEvent[] = [
      { t: "group", id: "g", ts: 1, name: "Trip", currency: "EUR", kind: "trip" },
      { t: "member", id: "m1", ts: 2, mid: "a", name: "Asha" },
      { t: "member", id: "m2", ts: 2, mid: "b", name: "Ben" },
      {
        t: "expense",
        id: "e1",
        ts: 3,
        eid: "x",
        desc: "Dinner",
        amount: 1000,
        currency: "EUR",
        paidBy: { a: 1000 },
        split: { method: "equal", parts: { a: 1, b: 1 } },
        date: "2026-10-01",
      },
      {
        t: "expense",
        id: "e2",
        ts: 5,
        eid: "x",
        desc: "Dinner",
        amount: 2000,
        currency: "EUR",
        paidBy: { a: 2000 },
        split: { method: "equal", parts: { a: 1, b: 1 } },
        date: "2026-10-01",
      },
      {
        t: "payment",
        id: "p1",
        ts: 6,
        pid: "p",
        from: "b",
        to: "a",
        amount: 400,
        currency: "EUR",
        date: "2026-10-02",
      },
    ];
    fc.assert(
      fc.property(fc.shuffledSubarray(evs, { minLength: evs.length }), (shuffled) => {
        const s = foldEvents(shuffled);
        expect(s.expenses).toHaveLength(1);
        expect(s.expenses[0]?.amount).toBe(2000);
        expect(balances(s)).toEqual({ EUR: { a: 600, b: -600 } });
      }),
    );
  });
});

describe("parseAmount", () => {
  it("reads amounts by currency", () => {
    expect(parseAmount("12.5", "USD")).toBe(1250);
    expect(parseAmount("1,200", "JPY")).toBe(1200);
    expect(parseAmount("1.5", "JPY")).toBeNull();
    expect(parseAmount("abc", "USD")).toBeNull();
    expect(parseAmount("1.234", "KWD")).toBe(1234);
  });
});
