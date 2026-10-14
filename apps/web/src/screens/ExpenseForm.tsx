import {
  currencyExponent,
  type ExpenseEvent,
  formatMoney,
  type GroupSecret,
  newId,
  owedShares,
  parseAmount,
  type SplitMethod,
  validateExpense,
} from "@rata/core";
import { useMemo, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { Avatar, CATEGORIES, CURRENCIES, Header, today } from "../lib/ui";

const METHODS: { id: SplitMethod; label: string }[] = [
  { id: "equal", label: "Equally" },
  { id: "exact", label: "Amounts" },
  { id: "percent", label: "Percent" },
  { id: "shares", label: "Shares" },
];

function fmtInput(minor: number, cur: string) {
  const exp = currencyExponent(cur);
  return (minor / 10 ** exp).toFixed(exp);
}

export function ExpenseForm({ saved, eid }: { saved: SavedGroup & GroupSecret; eid?: string }) {
  const { state, sync } = useGroup(saved);
  const existing = useMemo(() => state.expenses.find((e) => e.eid === eid), [state.expenses, eid]);
  const members = state.members;
  const group = state.group;

  const [init, setInit] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("General");
  const [note, setNote] = useState("");
  const [payer, setPayer] = useState<string>("");
  const [multiPay, setMultiPay] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [inSplit, setInSplit] = useState<Record<string, boolean>>({});
  const [parts, setParts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  if (!init && group && members.length) {
    setInit(true);
    if (existing) {
      setDesc(existing.desc);
      setAmount(fmtInput(existing.amount, existing.currency));
      setCurrency(existing.currency);
      setDate(existing.date);
      setCategory(existing.category ?? "General");
      setNote(existing.note ?? "");
      const payers = Object.keys(existing.paidBy);
      if (payers.length === 1) setPayer(payers[0] ?? "");
      else {
        setPayer("*");
        setMultiPay(
          Object.fromEntries(
            payers.map((p) => [p, fmtInput(existing.paidBy[p] ?? 0, existing.currency)]),
          ),
        );
      }
      setMethod(existing.split.method);
      setInSplit(
        Object.fromEntries(members.map((m) => [m.mid, (existing.split.parts[m.mid] ?? 0) > 0])),
      );
      setParts(
        Object.fromEntries(
          Object.entries(existing.split.parts).map(([k, v]) => [
            k,
            existing.split.method === "exact"
              ? fmtInput(v, existing.currency)
              : existing.split.method === "percent"
                ? String(v / 100)
                : String(v),
          ]),
        ),
      );
    } else {
      setCurrency(group.currency);
      setPayer(saved.me ?? members[0]?.mid ?? "");
      setInSplit(Object.fromEntries(members.map((m) => [m.mid, true])));
    }
  }

  const cur = currency || group?.currency || "USD";
  const total = parseAmount(amount, cur);

  const build = (): ExpenseEvent | string => {
    if (total === null) return "Enter a valid amount.";
    let paidBy: Record<string, number>;
    if (payer === "*") {
      paidBy = {};
      for (const [mid, v] of Object.entries(multiPay)) {
        const n = v.trim() ? parseAmount(v, cur) : 0;
        if (n === null) return "Check the amounts paid.";
        if (n > 0) paidBy[mid] = n;
      }
    } else paidBy = { [payer]: total };
    const p: Record<string, number> = {};
    for (const m of members) {
      if (method === "equal") {
        if (inSplit[m.mid]) p[m.mid] = 1;
        continue;
      }
      const raw = (parts[m.mid] ?? "").trim();
      if (!raw) continue;
      const n =
        method === "exact"
          ? parseAmount(raw, cur)
          : method === "percent"
            ? Math.round(Number(raw) * 100)
            : Number(raw);
      if (
        n === null ||
        !Number.isFinite(n) ||
        n < 0 ||
        (method === "shares" && !Number.isInteger(n))
      )
        return `Check the value for ${m.name}.`;
      if (n > 0) p[m.mid] = n;
    }
    return {
      t: "expense",
      id: newId(),
      ts: Date.now(),
      by: saved.me,
      eid: existing?.eid ?? newId(),
      desc: desc.trim(),
      amount: total,
      currency: cur,
      paidBy,
      split: { method, parts: p },
      date,
      category,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  };

  const preview = (() => {
    const e = build();
    if (typeof e === "string") return null;
    try {
      return owedShares(e);
    } catch {
      return null;
    }
  })();

  const save = async () => {
    const e = build();
    if (typeof e === "string") return setError(e);
    const v = validateExpense(e);
    if (v) return setError(v);
    await sync?.add([e]);
    go(`/g/${saved.gid}`);
  };

  const remove = async () => {
    if (
      !existing ||
      !confirm("Delete this expense? Everyone in the group will see that you deleted it.")
    )
      return;
    await sync?.add([
      { t: "expense.del", id: newId(), ts: Date.now(), by: saved.me, eid: existing.eid },
    ]);
    go(`/g/${saved.gid}`);
  };

  if (!group) return <Header title="Expense" back={`/g/${saved.gid}`} />;
  if (eid && !existing && init) {
    return (
      <div>
        <Header title="Expense" back={`/g/${saved.gid}`} />
        <p className="text-stone-500">This expense was deleted.</p>
      </div>
    );
  }

  const sumParts = members.reduce((a, m) => {
    const raw = (parts[m.mid] ?? "").trim();
    if (!raw) return a;
    return a + (method === "exact" ? (parseAmount(raw, cur) ?? 0) : Number(raw) || 0);
  }, 0);

  return (
    <div className="pb-10">
      <Header
        title={existing ? "Edit expense" : "Add expense"}
        back={`/g/${saved.gid}`}
        right={
          existing && (
            <button type="button" className="btn-ghost text-owes" onClick={remove}>
              Delete
            </button>
          )
        }
      />
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="desc">
            Description
          </label>
          <input
            id="desc"
            className="field"
            placeholder="Dinner, taxi, groceries"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            autoFocus={!existing}
          />
        </div>
        <div className="flex gap-2">
          <div className="w-28">
            <label className="label" htmlFor="cur">
              Currency
            </label>
            <select
              id="cur"
              className="field"
              value={cur}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="amt">
              Amount
            </label>
            <input
              id="amt"
              className="field num text-right text-lg"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="cat">
              Category
            </label>
            <select
              id="cat"
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="payer">
            Paid by
          </label>
          <select
            id="payer"
            className="field"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.mid} value={m.mid}>
                {m.mid === saved.me ? `${m.name} (you)` : m.name}
              </option>
            ))}
            <option value="*">More than one person</option>
          </select>
          {payer === "*" && (
            <div className="card mt-2 divide-y divide-stone-200 dark:divide-stone-800">
              {members.map((m) => (
                <div key={m.mid} className="flex items-center gap-3 p-2">
                  <Avatar name={m.name} />
                  <span className="flex-1 text-sm">{m.name}</span>
                  <input
                    className="field num w-32 text-right"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={multiPay[m.mid] ?? ""}
                    onChange={(e) => setMultiPay({ ...multiPay, [m.mid]: e.target.value })}
                    aria-label={`${m.name} paid`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="label">Split</span>
          <div className="mb-2 grid grid-cols-4 rounded-xl bg-stone-200/60 p-1 text-sm dark:bg-stone-800">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-lg py-2 font-medium ${method === m.id ? "bg-white shadow-sm dark:bg-stone-900" : "text-stone-500"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="card divide-y divide-stone-200 dark:divide-stone-800">
            {members.map((m) => (
              <div key={m.mid} className="flex items-center gap-3 p-2">
                {method === "equal" ? (
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-teal-700"
                    checked={!!inSplit[m.mid]}
                    onChange={(e) => setInSplit({ ...inSplit, [m.mid]: e.target.checked })}
                    aria-label={`Include ${m.name}`}
                  />
                ) : null}
                <Avatar name={m.name} />
                <span className="flex-1 text-sm">{m.name}</span>
                {method !== "equal" && (
                  <input
                    className="field num w-28 text-right"
                    inputMode="decimal"
                    placeholder={method === "shares" ? "0" : method === "percent" ? "0 %" : "0.00"}
                    value={parts[m.mid] ?? ""}
                    onChange={(e) => setParts({ ...parts, [m.mid]: e.target.value })}
                    aria-label={`${m.name} ${method}`}
                  />
                )}
                <span className="num w-24 text-right text-sm text-stone-500">
                  {preview?.[m.mid] ? formatMoney(preview[m.mid] ?? 0, cur) : "–"}
                </span>
              </div>
            ))}
          </div>
          {method === "exact" && total !== null && (
            <p className={`mt-1 text-xs ${sumParts === total ? "text-stone-500" : "text-owes"}`}>
              {formatMoney(sumParts, cur)} of {formatMoney(total, cur)}
            </p>
          )}
          {method === "percent" && (
            <p
              className={`mt-1 text-xs ${Math.round(sumParts * 100) === 10000 ? "text-stone-500" : "text-owes"}`}
            >
              {sumParts}% of 100%
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="note">
            Note (optional)
          </label>
          <input
            id="note"
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-owes">{error}</p>}
        <button type="button" className="btn-primary w-full py-3" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
