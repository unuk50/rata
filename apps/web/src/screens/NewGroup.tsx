import { type EventKind, newGroupSecret, newId, type RataEvent } from "@rata/core";
import { useState } from "react";
import { go } from "../lib/hooks";
import { storage } from "../lib/storage";
import { getSync } from "../lib/sync";
import { CURRENCIES, defaultCurrency, Header, KINDS } from "../lib/ui";

export function NewGroup() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EventKind>("trip");
  const [currency, setCurrency] = useState(defaultCurrency());
  const [me, setMe] = useState(localStorage.getItem("rata.myName") ?? "");
  const [others, setOthers] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || !me.trim()) return;
    setBusy(true);
    localStorage.setItem("rata.myName", me.trim());
    const secret = newGroupSecret();
    const myId = newId();
    const ts = Date.now();
    const events: RataEvent[] = [
      { t: "group", id: newId(), ts, by: myId, name: name.trim(), currency, kind },
      { t: "member", id: newId(), ts, by: myId, mid: myId, name: me.trim() },
      ...others
        .split(/[,\n]/)
        .map((n) => n.trim())
        .filter(Boolean)
        .map(
          (n, i): RataEvent => ({
            t: "member",
            id: newId(),
            ts: ts + 1 + i,
            by: myId,
            mid: newId(),
            name: n,
          }),
        ),
    ];
    await storage.upsertGroup({ ...secret, me: myId, name: name.trim(), addedAt: ts });
    await getSync(secret).add(events);
    go(`/g/${secret.gid}/invite`);
  };

  return (
    <div>
      <Header title="New group" back="/" />
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="gname">
            Group name
          </label>
          <input
            id="gname"
            className="field"
            placeholder="Goa trip, Flat 4B, Friday dinner"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <span className="label">What type of event?</span>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-xl border p-3 text-left ${kind === k.id ? "border-brand bg-brand-soft/40 dark:bg-teal-950" : "border-stone-300 dark:border-stone-700"}`}
              >
                <div className="font-medium">{k.label}</div>
                <div className="text-xs text-stone-500">{k.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="gcur">
            Main currency
          </label>
          <select
            id="gcur"
            className="field"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">
            Each expense can use its own currency. Totals use this one.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="me">
            Your name
          </label>
          <input id="me" className="field" value={me} onChange={(e) => setMe(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="others">
            Other people (optional)
          </label>
          <textarea
            id="others"
            className="field"
            rows={3}
            placeholder="Asha, Ben, Chen"
            value={others}
            onChange={(e) => setOthers(e.target.value)}
          />
          <p className="mt-1 text-xs text-stone-500">
            Separate names with commas. People can also add themselves from the invite link.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary w-full py-3"
          disabled={busy || !name.trim() || !me.trim()}
          onClick={create}
        >
          Create group
        </button>
      </div>
    </div>
  );
}
