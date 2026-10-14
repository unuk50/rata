import {
  type ExpenseEvent,
  formatMoney,
  type GroupSecret,
  newId,
  owedShares,
  parseAmount,
  type SplitMethod,
  validateExpense,
} from "@rata/core";
import { useEffect, useMemo, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import {
  Avatar,
  amountInput,
  CATEGORIES,
  CURRENCIES,
  Header,
  PeoplePicker,
  TabPanel,
  Tabs,
  today,
  zero,
} from "../lib/ui";

const METHODS: { id: SplitMethod; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "exact", label: "Exact" },
  { id: "percent", label: "%" },
  { id: "shares", label: "Shares" },
];

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
  // A changed input makes the old error wrong, so clear it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these inputs reset the error
  useEffect(() => setError(""), [desc, amount, currency, payer, multiPay, method, inSplit, parts]);

  if (!init && group && members.length) {
    setInit(true);
    if (existing) {
      setDesc(existing.desc);
      setAmount(amountInput(existing.amount, existing.currency));
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
            payers.map((p) => [p, amountInput(existing.paidBy[p] ?? 0, existing.currency)]),
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
              ? amountInput(v, existing.currency)
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
        <p className="text-muted">This expense was deleted.</p>
      </div>
    );
  }

  const sumParts = members.reduce((a, m) => {
    const raw = (parts[m.mid] ?? "").trim();
    if (!raw) return a;
    return a + (method === "exact" ? (parseAmount(raw, cur) ?? 0) : Number(raw) || 0);
  }, 0);
  const inCount = members.filter((m) => inSplit[m.mid]).length;
  const each = preview ? Object.values(preview).find((v) => v > 0) : undefined;
  const isToday = date === today();

  return (
    <div className="pb-28">
      <Header
        title={existing ? "Edit expense" : "Add expense"}
        back={`/g/${saved.gid}`}
        right={
          existing && (
            <button type="button" className="btn-ghost btn-sm text-owes" onClick={remove}>
              Delete
            </button>
          )
        }
      />
      <div className="space-y-6">
        <div className="card flex items-center gap-2 p-3">
          <select
            id="cur"
            className="field w-24 shrink-0 font-extrabold"
            value={cur}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            id="amt"
            className="amount"
            inputMode="decimal"
            placeholder={zero(cur)}
            aria-label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              if (total) setAmount(amountInput(total, cur));
            }}
            autoFocus={!existing}
          />
        </div>
        <input
          id="desc"
          className="field text-lg font-bold"
          placeholder="What for?"
          aria-label="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="caps">Paid by</h2>
            <button
              type="button"
              className="caps underline"
              onClick={() => setPayer(payer === "*" ? (saved.me ?? members[0]?.mid ?? "") : "*")}
            >
              {payer === "*" ? "One person" : "Several people"}
            </button>
          </div>
          {payer !== "*" ? (
            <PeoplePicker
              label="Paid by"
              people={members}
              me={saved.me}
              selected={(mid) => payer === mid}
              onToggle={setPayer}
            />
          ) : (
            <div className="card divider">
              {members.map((m, i) => (
                <div key={m.mid} className="flex items-center gap-3 p-2">
                  <Avatar name={m.name} i={i} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.name}</span>
                  <input
                    className="field num w-32 text-right"
                    inputMode="decimal"
                    placeholder={zero(cur)}
                    value={multiPay[m.mid] ?? ""}
                    onChange={(e) => setMultiPay({ ...multiPay, [m.mid]: e.target.value })}
                    aria-label={`${m.name} paid`}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="caps mb-2">Split</h2>
          <div className="mb-3">
            <Tabs id="split" options={METHODS} value={method} onChange={setMethod} />
          </div>
          <TabPanel id="split" value={method}>
            {method === "equal" ? (
              <>
                <PeoplePicker
                  label="Split between"
                  people={members}
                  me={saved.me}
                  selected={(mid) => !!inSplit[mid]}
                  onToggle={(mid) => setInSplit({ ...inSplit, [mid]: !inSplit[mid] })}
                />
                <p className="caps mt-2">
                  {inCount === 0
                    ? "Tap people to split"
                    : `${inCount} ${inCount === 1 ? "person" : "people"}${each ? ` · ${formatMoney(each, cur)} each` : ""}`}
                </p>
              </>
            ) : (
              <>
                <div className="card divider">
                  {members.map((m, i) => (
                    <div key={m.mid} className="flex items-center gap-3 p-2">
                      <Avatar name={m.name} i={i} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.name}</span>
                      <input
                        className="field num w-24 text-right"
                        inputMode="decimal"
                        placeholder={method === "exact" ? zero(cur) : "0"}
                        value={parts[m.mid] ?? ""}
                        onChange={(e) => setParts({ ...parts, [m.mid]: e.target.value })}
                        aria-label={`${m.name} ${method}`}
                      />
                      <span className="num w-20 shrink-0 text-right text-sm text-muted">
                        {preview?.[m.mid] ? formatMoney(preview[m.mid] ?? 0, cur) : "0"}
                      </span>
                    </div>
                  ))}
                </div>
                {method === "exact" && total !== null && (
                  <p className={`caps mt-2 ${sumParts === total ? "" : "text-owes"}`}>
                    {formatMoney(sumParts, cur)} / {formatMoney(total, cur)}
                  </p>
                )}
                {method === "percent" && (
                  <p
                    className={`caps mt-2 ${Math.round(sumParts * 100) === 10000 ? "" : "text-owes"}`}
                  >
                    {sumParts}% / 100%
                  </p>
                )}
              </>
            )}
          </TabPanel>
        </section>

        <details
          className="group"
          open={!!existing && (!isToday || category !== "General" || !!note)}
        >
          <summary className="caps flex cursor-pointer list-none items-center gap-2">
            <span className="text-fg-2">{isToday ? "Today" : date}</span>·
            <span className="text-fg-2">{category}</span>
            {note && <span className="text-fg-2">· Note</span>}
            <span className="ml-auto underline">More</span>
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
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
              <div className="min-w-0 flex-1">
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
              <label className="label" htmlFor="note">
                Note
              </label>
              <input
                id="note"
                className="field"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </details>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          {error && <p className="mb-2 text-sm text-owes">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
