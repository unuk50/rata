import { type EventKind, newGroupSecret, newId, type RataEvent } from "@rata/core";
import { useState } from "react";
import { go } from "../lib/hooks";
import { storage } from "../lib/storage";
import { getSync } from "../lib/sync";
import { Avatar, CURRENCIES, defaultCurrency, Header, Icon, KINDS } from "../lib/ui";

export function NewGroup() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EventKind>("trip");
  const [currency, setCurrency] = useState(defaultCurrency());
  const [me, setMe] = useState(localStorage.getItem("rata.myName") ?? "");
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const addNames = (text: string) => {
    const names = text
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length) setPeople((cur) => [...cur, ...names.map((name) => ({ id: newId(), name }))]);
  };
  const addDraft = () => {
    addNames(draft);
    setDraft("");
  };

  const create = async () => {
    if (!name.trim() || !me.trim()) return;
    setBusy(true);
    localStorage.setItem("rata.myName", me.trim());
    const all = [...people.map((p) => p.name), ...draft.split(/[,\n]/)]
      .map((n) => n.trim())
      .filter(Boolean);
    const secret = newGroupSecret();
    const myId = newId();
    const ts = Date.now();
    const events: RataEvent[] = [
      { t: "group", id: newId(), ts, by: myId, name: name.trim(), currency, kind },
      { t: "member", id: newId(), ts, by: myId, mid: myId, name: me.trim() },
      ...all.map(
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
    <div className="pb-10">
      <Header title="New group" back="/" />
      <div className="space-y-6">
        <input
          id="gname"
          className="field text-xl font-extrabold"
          placeholder="Group name"
          aria-label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <fieldset className="grid grid-cols-4 gap-2">
          <legend className="sr-only">Type</legend>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`${kind === k.id ? "choice choice-on" : "choice"} flex flex-col items-center gap-1 px-1 py-3`}
            >
              <span className="text-2xl" aria-hidden="true">
                {k.emoji}
              </span>
              <span className="text-xs font-extrabold tracking-wide uppercase">{k.label}</span>
            </button>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="me">
              You
            </label>
            <input
              id="me"
              className="field"
              placeholder="Your name"
              value={me}
              onChange={(e) => setMe(e.target.value)}
            />
          </div>
          <div className="w-28">
            <label className="label" htmlFor="gcur">
              Currency
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
          </div>
        </div>
        <div>
          <label className="label" htmlFor="others">
            People
          </label>
          {people.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {people.map((p, i) => (
                <li key={p.id} className="chip">
                  <Avatar name={p.name} i={i + 1} />
                  <span className="text-sm font-bold">{p.name}</span>
                  <button
                    type="button"
                    className="btn-icon h-9 w-9"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              id="others"
              className="field min-w-0"
              placeholder="Add a name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/[,\n]/.test(text)) {
                  e.preventDefault();
                  addNames(`${draft},${text}`);
                  setDraft("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addDraft();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              aria-label="Add person"
              disabled={!draft.trim()}
              onClick={addDraft}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || !name.trim() || !me.trim()}
          onClick={create}
        >
          Create group
        </button>
      </div>
    </div>
  );
}
