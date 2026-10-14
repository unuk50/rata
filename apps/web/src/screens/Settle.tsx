import { type GroupSecret, newId, parseAmount } from "@rata/core";
import { useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { CURRENCIES, Header, today } from "../lib/ui";

export function Settle({ saved, prefill }: { saved: SavedGroup & GroupSecret; prefill: string[] }) {
  const { state, sync } = useGroup(saved);
  const [pf, pt, pa, pc] = prefill;
  const cur0 = pc ?? state.group?.currency ?? "USD";
  const [from, setFrom] = useState(pf ?? saved.me ?? "");
  const [to, setTo] = useState(pt ?? "");
  const [currency, setCurrency] = useState(cur0);
  const [amount, setAmount] = useState(
    pa
      ? String(
          Number(pa) /
            10 **
              (new Intl.NumberFormat("en", { style: "currency", currency: cur0 }).resolvedOptions()
                .maximumFractionDigits ?? 2),
        )
      : "",
  );
  const [error, setError] = useState("");
  const members = state.members;
  const toId = to || members.find((m) => m.mid !== from)?.mid || "";

  const save = async () => {
    const v = parseAmount(amount, currency);
    if (!v || v <= 0) return setError("Enter an amount above zero.");
    if (from === toId) return setError("Pick two different people.");
    await sync?.add([
      {
        t: "payment",
        id: newId(),
        ts: Date.now(),
        by: saved.me,
        pid: newId(),
        from,
        to: toId,
        amount: v,
        currency,
        date: today(),
      },
    ]);
    go(`/g/${saved.gid}`);
  };

  return (
    <div>
      <Header title="Record a payment" back={`/g/${saved.gid}`} />
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="from">
            Who paid
          </label>
          <select
            id="from"
            className="field"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.mid} value={m.mid}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="to">
            To whom
          </label>
          <select id="to" className="field" value={toId} onChange={(e) => setTo(e.target.value)}>
            {members
              .filter((m) => m.mid !== from)
              .map((m) => (
                <option key={m.mid} value={m.mid}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-2">
          <select
            className="field w-28"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            className="field num flex-1 text-right text-lg"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
        </div>
        <p className="text-xs text-stone-500">
          Pay with any app you like. Rata records the payment. It does not move money.
        </p>
        {error && <p className="text-sm text-owes">{error}</p>}
        <button type="button" className="btn-primary w-full py-3" onClick={save}>
          Save payment
        </button>
      </div>
    </div>
  );
}
