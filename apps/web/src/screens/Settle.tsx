import { currencyExponent, type GroupSecret, newId, parseAmount } from "@rata/core";
import { useState } from "react";
import { go, useGroup } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { CURRENCIES, Header, Icon, PeoplePicker, today } from "../lib/ui";

export function Settle({ saved, prefill }: { saved: SavedGroup & GroupSecret; prefill: string[] }) {
  const { state, sync } = useGroup(saved);
  const [pf, pt, pa, pc] = prefill;
  const [from, setFrom] = useState(pf ?? saved.me ?? "");
  const [to, setTo] = useState(pt ?? "");
  const [currency, setCurrency] = useState(pc ?? "");
  const [amount, setAmount] = useState(
    pa && pc ? (Number(pa) / 10 ** currencyExponent(pc)).toFixed(currencyExponent(pc)) : "",
  );
  const [error, setError] = useState("");
  const members = state.members;
  const cur = currency || state.group?.currency || "USD";
  const toId = to && to !== from ? to : members.find((m) => m.mid !== from)?.mid || "";

  const save = async () => {
    const v = parseAmount(amount, cur);
    if (!v || v <= 0) return setError("Enter an amount.");
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
        currency: cur,
        date: today(),
      },
    ]);
    go(`/g/${saved.gid}`);
  };

  return (
    <div className="pb-28">
      <Header title="Record a payment" back={`/g/${saved.gid}`} />
      <div className="space-y-6">
        <section>
          <h2 className="caps mb-2">From</h2>
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
          <h2 className="caps mb-2">To</h2>
          <PeoplePicker
            label="To"
            people={members.filter((m) => m.mid !== from)}
            indexOf={(mid) => members.findIndex((m) => m.mid === mid)}
            me={saved.me}
            selected={(mid) => mid === toId}
            onToggle={setTo}
          />
        </section>
        <div className="card flex items-center gap-2 p-3">
          <select
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
            className="amount"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
        </div>
        <p className="caps text-center">Records only. No money moves.</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          {error && <p className="mb-2 text-sm text-owes">{error}</p>}
          <button type="button" className="btn-primary w-full" onClick={save}>
            Save payment
          </button>
        </div>
      </div>
    </div>
  );
}
