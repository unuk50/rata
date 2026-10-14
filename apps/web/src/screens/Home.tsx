import { balances, convertBalances, decodeInvite, foldEvents, type Rates } from "@rata/core";
import { useEffect, useState } from "react";
import { go, useGroups, useRates } from "../lib/hooks";
import { type SavedGroup, storage } from "../lib/storage";
import { Icon, KINDS, Money } from "../lib/ui";

interface Net {
  kind?: string;
  /** Null: nothing to show yet, or it needs rates that are not here. */
  v: number | null;
  c: string;
}

/** My net in each group, in the group currency. Null when it needs rates that are not here. */
function useMyNets(groups: SavedGroup[] | null, rates: Rates | null) {
  const [nets, setNets] = useState<Record<string, Net>>({});
  useEffect(() => {
    if (!groups) return;
    void Promise.all(
      groups.map(async (g) => {
        const state = foldEvents(Object.values((await storage.cache(g.gid)).events));
        const cur = state.group?.currency ?? "USD";
        const bal = balances(state);
        const kind = state.group?.kind;
        const curs = Object.keys(bal).filter((c) => Object.values(bal[c] ?? {}).some((v) => v));
        const none = { kind, v: null, c: cur };
        if (!g.me || state.expenses.length + state.payments.length === 0)
          return [g.gid, none] as const;
        if (curs.length === 0) return [g.gid, { kind, v: 0, c: cur }] as const;
        if (curs.length === 1 && curs[0] === cur) {
          return [g.gid, { kind, v: bal[cur]?.[g.me] ?? 0, c: cur }] as const;
        }
        const conv = rates ? convertBalances(bal, cur, rates) : null;
        return [g.gid, conv ? { kind, v: conv[g.me] ?? 0, c: cur } : none] as const;
      }),
    ).then((rows) => setNets(Object.fromEntries(rows)));
  }, [groups, rates]);
  return nets;
}

export function Home() {
  const [groups] = useGroups();
  const rates = useRates();
  const nets = useMyNets(groups, (rates?.rates as Rates) ?? null);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [about, setAbout] = useState(false);
  const [pasting, setPasting] = useState(false);

  const join = () => {
    const s = decodeInvite(link);
    if (!s) return setErr("Not a Rata link.");
    go(`/join/${s.gid}.${s.key}`);
  };

  return (
    <div className="space-y-8 pt-8 pb-10">
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-11 w-11" />
        <h1 className="title flex-1">rata</h1>
        <button
          type="button"
          className="caps flex min-h-11 items-center gap-1.5 px-1"
          aria-expanded={about}
          onClick={() => setAbout(!about)}
        >
          <Icon name="lock" size={14} />
          Private
        </button>
      </div>

      {about && (
        <ul className="card space-y-2 p-4 text-sm text-fg-2">
          <li>Your phone locks each entry before it leaves.</li>
          <li>Only people with the invite link can read the group.</li>
          <li>No account. No ads. No tracking.</li>
        </ul>
      )}

      {groups && groups.length === 0 && (
        <p className="text-[34px] leading-[1.05] font-extrabold tracking-tight">
          Split costs.
          <br />
          <span className="text-accent">Not friendships.</span>
        </p>
      )}

      {groups && groups.length > 0 && (
        <ul className="card divider">
          {groups
            .slice()
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((g) => (
              <li key={g.gid}>
                <button
                  type="button"
                  className="row min-h-16 hover:bg-raised"
                  onClick={() => go(`/g/${g.gid}`)}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-lg">
                    {KINDS.find((k) => k.id === nets[g.gid]?.kind)?.emoji ?? KINDS[3].emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lg font-bold">{g.name}</span>
                  <GroupNet n={nets[g.gid]} />
                </button>
              </li>
            ))}
        </ul>
      )}

      <button type="button" className="btn-primary w-full" onClick={() => go("/new")}>
        <Icon name="plus" size={18} /> New group
      </button>

      {pasting ? (
        <div>
          <div className="flex gap-2">
            <input
              id="invite"
              className="field min-w-0"
              placeholder="Paste an invite link"
              aria-label="Invite link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setErr("");
              }}
              autoFocus
            />
            <button type="button" className="btn-secondary" disabled={!link.trim()} onClick={join}>
              Join
            </button>
          </div>
          {err && <p className="mt-1 text-sm text-owes">{err}</p>}
        </div>
      ) : (
        <button type="button" className="btn-ghost w-full" onClick={() => setPasting(true)}>
          <Icon name="link" size={18} /> Have an invite link?
        </button>
      )}

      <p className="text-center text-xs text-muted">
        <a
          className="inline-flex min-h-11 items-center underline"
          href="https://github.com/unuk50/rata"
          target="_blank"
          rel="noreferrer"
          id="repo-link"
        >
          Open source
        </a>
      </p>
    </div>
  );
}

function GroupNet({ n }: { n: Net | undefined }) {
  if (!n || n.v === null) {
    return (
      <span className="text-muted">
        <Icon name="arrow" />
      </span>
    );
  }
  if (n.v === 0) return <span className="caps text-owed">Square</span>;
  return (
    <span className="text-right">
      <span className="caps block">{n.v > 0 ? "You get" : "You owe"}</span>
      <span className="font-extrabold">
        <Money v={n.v} c={n.c} tone />
      </span>
    </span>
  );
}
