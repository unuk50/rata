import {
  allocate,
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
import { useEffect, useMemo, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { toast } from "../lib/toast";
import {
  Avatar,
  amountInput,
  CATEGORIES,
  CURRENCIES,
  Header,
  Notice,
  PeoplePicker,
  reAmount,
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

/** Say why an amount does not parse: too many decimals for the currency, or not a number. */
function amountError(text: string, cur: string): string {
  if (!text.trim()) return "Enter an amount.";
  const dec = text.trim().split(".")[1];
  const exp = currencyExponent(cur);
  if (dec !== undefined && /^\d+$/.test(dec) && dec.length > exp)
    return exp === 0 ? `${cur} has no decimals.` : `${cur} has ${exp} decimals.`;
  return "Enter a valid amount.";
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

  const paidSoFar = Object.values(multiPay).reduce((t, v) => t + (parseAmount(v, cur) ?? 0), 0);

  const build = (): ExpenseEvent | string => {
    if (total === null) return amountError(amount, cur);
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
        return method === "shares"
          ? `Shares are whole numbers (${m.name}).`
          : `Check the value for ${m.name}.`;
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

  /** Start each method with an even split, so the form does not open on an error. */
  const pickMethod = (m: SplitMethod) => {
    setMethod(m);
    if (m === "equal") return;
    if (existing && existing.split.method === m) {
      // Back to the saved method: bring back the saved values.
      const ps = existing.split.parts;
      setParts(
        Object.fromEntries(
          Object.entries(ps).map(([k, v]) => [
            k,
            m === "exact"
              ? reAmount(amountInput(v, existing.currency), existing.currency, cur)
              : m === "percent"
                ? String(v / 100)
                : String(v),
          ]),
        ),
      );
      return;
    }
    const ids = members.filter((x) => inSplit[x.mid]).map((x) => x.mid);
    const who = ids.length ? ids : members.map((x) => x.mid);
    const even = (n: number) =>
      allocate(
        n,
        who.map(() => 1),
      );
    const vals =
      m === "shares"
        ? who.map(() => "1")
        : m === "percent"
          ? even(10000).map((v) => String(v / 100))
          : total
            ? even(total).map((v) => amountInput(v, cur))
            : who.map(() => "");
    setParts(Object.fromEntries(who.map((mid, i) => [mid, vals[i] ?? ""])));
  };

  const save = async () => {
    const e = build();
    if (typeof e === "string") return setError(e);
    const v = validateExpense(e);
    if (v) return setError(v);
    if (!sync) return setError("Still loading. Try again.");
    await sync.add([e]);
    go(`/g/${saved.gid}`);
    toast(existing ? `Saved “${e.desc}”` : `Added “${e.desc}”`);
  };

  const remove = async () => {
    if (!existing || !sync) return;
    await sync.add([
      { t: "expense.del", id: newId(), ts: Date.now(), by: saved.me, eid: existing.eid },
    ]);
    go(`/g/${saved.gid}`);
    toast(`Deleted “${existing.desc}”`, {
      label: "Undo",
      run: () => void sync.add([{ ...existing, id: newId(), ts: Date.now(), by: saved.me }]),
    });
  };

  if (!group) return <Header title="Expense" back={`/g/${saved.gid}`} />;
  if (eid && !existing && init) {
    return (
      <div>
        <Header title="Expense" back={`/g/${saved.gid}`} />
        <Notice
          icon="x"
          text="This expense was deleted."
          action="Back to group"
          to={`/g/${saved.gid}`}
        />
      </div>
    );
  }

  const sumParts = members.reduce((a, m) => {
    const raw = (parts[m.mid] ?? "").trim();
    if (!raw) return a;
    return a + (method === "exact" ? (parseAmount(raw, cur) ?? 0) : Number(raw) || 0);
  }, 0);
  const inCount = members.filter((m) => inSplit[m.mid]).length;
  // Shares of the people in the split, zeros included: 0.01 for three is 0.01, 0, 0.
  const shares = preview
    ? members.filter((m) => inSplit[m.mid]).map((m) => preview[m.mid] ?? 0)
    : [];
  const each = shares.length ? Math.min(...shares) : undefined;
  // A remainder cent can make shares differ. Then the amount is "about" each share.
  const about = shares.some((v) => v !== each) ? "about " : "";
  const isToday = date === today();

  return (
    <div className="pb-36">
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
        {/* Amount first and big, centred; the currency reads as text above it. */}
        <div className="flex flex-col items-center gap-1 pt-2 pb-4">
          <select
            id="cur"
            className="select-plain text-sm tracking-wide"
            value={cur}
            onChange={(e) => {
              const to = e.target.value;
              const newAmount = reAmount(amount, cur, to);
              const newTotal = parseAmount(newAmount, to);
              // Spread the new total in the same proportions, so rounding cannot unbalance the parts.
              const conv = (vals: Record<string, string>) => {
                const keys = Object.keys(vals).filter((k) => vals[k]?.trim());
                const old = keys.map((k) => parseAmount(vals[k] ?? "", cur) ?? 0);
                const balanced = old.reduce((x, y) => x + y, 0) === parseAmount(amount, cur);
                if (
                  newTotal === null ||
                  !balanced ||
                  old.some((v) => v < 0) ||
                  old.every((v) => !v)
                )
                  return Object.fromEntries(
                    Object.entries(vals).map(([k, v]) => [k, reAmount(v, cur, to)]),
                  );
                const shares = allocate(newTotal, old);
                return {
                  ...vals,
                  ...Object.fromEntries(keys.map((k, i) => [k, amountInput(shares[i] ?? 0, to)])),
                };
              };
              setAmount(newAmount);
              setMultiPay(conv(multiPay));
              if (method === "exact") setParts(conv(parts));
              setCurrency(to);
            }}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            id="amt"
            className="amount text-center"
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
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {m.mid === saved.me ? "You" : m.name}
                  </span>
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
              {total !== null && (
                <div className={`caps p-2 text-right ${paidSoFar === total ? "" : "text-owes"}`}>
                  Paid {formatMoney(paidSoFar, cur)} of {formatMoney(total, cur)}
                  {paidSoFar < total && ` · ${formatMoney(total - paidSoFar, cur)} left`}
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="caps mb-2">Split</h2>
          <div className="mb-3">
            <Tabs id="split" options={METHODS} value={method} onChange={pickMethod} />
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
                    : `${inCount} ${inCount === 1 ? "person" : "people"}${each !== undefined ? ` · ${about}${formatMoney(each, cur)} each` : ""}`}
                </p>
              </>
            ) : (
              <>
                <div className="card divider">
                  {members.map((m, i) => (
                    <div key={m.mid} className="flex items-center gap-3 p-2">
                      <Avatar name={m.name} i={i} />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {m.mid === saved.me ? "You" : m.name}
                      </span>
                      <input
                        className="field num w-24 text-right"
                        inputMode="decimal"
                        placeholder={method === "exact" ? zero(cur) : "0"}
                        value={parts[m.mid] ?? ""}
                        onChange={(e) => setParts({ ...parts, [m.mid]: e.target.value })}
                        aria-label={`${m.name} ${method}`}
                      />
                      {method !== "exact" && (
                        <span className="num w-20 shrink-0 text-right text-sm text-muted">
                          {preview?.[m.mid] ? formatMoney(preview[m.mid] ?? 0, cur) : "—"}
                        </span>
                      )}
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
