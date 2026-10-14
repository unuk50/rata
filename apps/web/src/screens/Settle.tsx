import { formatMoney, type GroupSecret, newId, parseAmount } from "@rata/core";
import { useEffect, useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { toast } from "../lib/toast";
import {
  amountInput,
  amountWidth,
  CURRENCIES,
  currencySymbol,
  Header,
  Icon,
  Notice,
  PeoplePicker,
  reAmount,
  today,
  zero,
} from "../lib/ui";

export function Settle({
  saved,
  prefill = [],
  pid,
}: {
  saved: SavedGroup & GroupSecret;
  prefill?: string[];
  pid?: string;
}) {
  const { state, sync } = useGroup(saved);
  const [pf, pt, pa, pc] = prefill;
  const [from, setFrom] = useState(pf ?? saved.me ?? "");
  const [to, setTo] = useState(pt ?? "");
  const [currency, setCurrency] = useState(pc ?? "");
  const [amount, setAmount] = useState(pa && pc ? amountInput(Number(pa), pc) : "");
  const [error, setError] = useState("");
  const [init, setInit] = useState(!pid);
  const existing = pid ? state.payments.find((p) => p.pid === pid) : undefined;
  const members = state.members;

  if (!init && existing) {
    setInit(true);
    setFrom(existing.from);
    setTo(existing.to);
    setCurrency(existing.currency);
    setAmount(amountInput(existing.amount, existing.currency));
  }

  // A changed input makes the old error wrong, so clear it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these inputs reset the error
  useEffect(() => setError(""), [from, to, amount, currency]);
  const cur = currency || state.group?.currency || "USD";
  const toId = to && to !== from ? to : members.find((m) => m.mid !== from)?.mid || "";

  const who = (mid: string) =>
    mid === saved.me ? "you" : (members.find((m) => m.mid === mid)?.name ?? "?");

  const save = async () => {
    const v = parseAmount(amount, cur);
    if (!v || v <= 0) return setError("Enter an amount.");
    if (!toId) return setError("Add someone to pay first.");
    if (from === toId) return setError("Pick two different people.");
    if (!sync) return setError("Still loading. Try again.");
    await sync.add([
      {
        t: "payment",
        id: newId(),
        ts: Date.now(),
        by: saved.me,
        pid: existing?.pid ?? newId(),
        from,
        to: toId,
        amount: v,
        currency: cur,
        date: existing?.date ?? today(),
      },
    ]);
    go(`/g/${saved.gid}`);
    const line = `${from === saved.me ? "You" : who(from)} paid ${who(toId)} ${formatMoney(v, cur)}`;
    toast(existing ? `Saved: ${line}` : line);
  };

  const remove = async () => {
    if (!existing || !sync) return;
    await sync.add([
      { t: "payment.del", id: newId(), ts: Date.now(), by: saved.me, pid: existing.pid },
    ]);
    go(`/g/${saved.gid}`);
    toast(`Deleted payment to ${who(existing.to)}`, {
      label: "Undo",
      run: () => void sync.add([{ ...existing, id: newId(), ts: Date.now(), by: saved.me }]),
    });
  };

  if (pid && !existing && state.group) {
    return (
      <div>
        <Header title="Payment" back={`/g/${saved.gid}`} />
        <Notice
          icon="x"
          text="This payment was deleted."
          action="Back to group"
          to={`/g/${saved.gid}`}
        />
      </div>
    );
  }

  return (
    <div className="pb-28">
      <Header
        title={existing ? "Edit payment" : "Record a payment"}
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
        <div className="flex flex-col items-center gap-1 pt-2 pb-4">
          <select
            className="select-plain text-sm"
            value={cur}
            onChange={(e) => {
              setAmount(reAmount(amount, cur, e.target.value));
              setCurrency(e.target.value);
            }}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="flex max-w-full items-baseline justify-center gap-1">
            {currencySymbol(cur) && (
              <span className="text-4xl font-extrabold text-muted" aria-hidden="true">
                {currencySymbol(cur)}
              </span>
            )}
            <input
              className="amount"
              style={{ width: amountWidth(amount, cur) }}
              inputMode="decimal"
              placeholder={zero(cur)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const v = parseAmount(amount, cur);
                if (v) setAmount(amountInput(v, cur));
              }}
              aria-label="Amount"
            />
          </div>
        </div>
        <section>
          <h2 className="meta mb-2">From</h2>
          <PeoplePicker
            label="From"
            people={members}
            me={saved.me}
            selected={(mid) => mid === from}
            onToggle={setFrom}
          />
        </section>
        <div className="flex justify-center text-muted" aria-hidden="true">
          <span className="rotate-90">
            <Icon name="arrow" />
          </span>
        </div>
        <section>
          <h2 className="meta mb-2">To</h2>
          <PeoplePicker
            label="To"
            people={members}
            disabled={(mid) => mid === from}
            me={saved.me}
            selected={(mid) => mid === toId}
            onToggle={setTo}
          />
        </section>
        <p className="meta text-center">Records only. No money moves.</p>
      </div>
      <div className="bottom-bar">
        <div className="mx-auto max-w-xl">
          {error && <p className="mb-2 text-sm text-owes">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={save} disabled={!sync}>
            Save payment
          </button>
        </div>
      </div>
    </div>
  );
}
