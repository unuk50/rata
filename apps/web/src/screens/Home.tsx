import { balances, convertBalances, decodeInvite, foldEvents, type Rates } from "@rata/core";
import { useEffect, useState } from "react";
import { go, useGroups, useRates } from "../lib/hooks";
import { type SavedGroup, storage } from "../lib/storage";
import { Icon, KINDS, Money } from "../lib/ui";

interface Net {
  kind?: string;
  /** Null: nothing to show yet, or it needs rates that are not here. */
  v: number | null;
  /** Why v is null. */
  why?: "new" | "rates";
  c: string;
  /** Time of the newest change, to sort groups by activity. */
  last?: number;
}

/** My net in each group, in the group currency. Null when it needs rates that are not here. */
function useMyNets(groups: SavedGroup[] | null, rates: Rates | null) {
  const [nets, setNets] = useState<Record<string, Net>>({});
  useEffect(() => {
    if (!groups) return;
    let live = true;
    void Promise.all(
      groups.map(async (g) => {
        // One unreadable group must not hide the others.
        const cache = await storage.cache(g.gid).catch(() => null);
        if (!cache) return [g.gid, { v: null, c: "USD" }] as const;
        const events = Object.values(cache.events);
        const last = Math.max(g.addedAt, ...events.map((e) => e.ts));
        const net = netOf(g, foldEvents(events));
        return [g.gid, { ...net, last }] as const;
      }),
    ).then((rows) => {
      if (live) setNets(Object.fromEntries(rows));
    });
    return () => {
      live = false;
    };

    function netOf(g: SavedGroup, state: ReturnType<typeof foldEvents>): Net {
      const cur = state.group?.currency ?? "USD";
      const bal = balances(state);
      const kind = state.group?.kind;
      const curs = Object.keys(bal).filter((c) => Object.values(bal[c] ?? {}).some((v) => v));
      if (!g.me || state.expenses.length + state.payments.length === 0)
        return { kind, v: null, c: cur, why: "new" };
      if (curs.length === 0) return { kind, v: 0, c: cur };
      if (curs.length === 1 && curs[0] === cur) {
        return { kind, v: bal[cur]?.[g.me] ?? 0, c: cur };
      }
      // Only currencies with open balances need a rate.
      const open = Object.fromEntries(curs.map((c) => [c, bal[c] ?? {}]));
      const conv = rates ? convertBalances(open, cur, rates) : null;
      return conv ? { kind, v: conv[g.me] ?? 0, c: cur } : { kind, v: null, c: cur, why: "rates" };
    }
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
            .sort((a, b) => (nets[b.gid]?.last ?? b.addedAt) - (nets[a.gid]?.last ?? a.addedAt))
            .map((g) => (
              <li key={g.gid}>
                <button
                  type="button"
                  className="row min-h-16 hover:bg-raised"
                  onClick={() => go(`/g/${g.gid}`)}
                >
                  {/* The group's letter tells groups of one kind apart; the kind is a badge. */}
                  <span className="tile h-11 w-11 text-lg">
                    {g.name.trim().charAt(0).toUpperCase() || "?"}
                    <span
                      className="absolute right-0.5 bottom-0.5 text-[11px] leading-none"
                      aria-hidden="true"
                    >
                      {KINDS.find((k) => k.id === nets[g.gid]?.kind)?.emoji ?? KINDS[3].emoji}
                    </span>
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
  if (n?.why === "new") return <span className="caps text-faint">New</span>;
  if (n?.why === "rates")
    return (
      <span className="caps text-faint" title="Needs exchange rates">
        No rates
      </span>
    );
  if (!n || n.v === null) return null;
  if (n.v === 0) return <span className="caps text-owed">Settled</span>;
  return (
    <span className="text-right">
      <span className="caps block">{n.v > 0 ? "You get" : "You owe"}</span>
      <span className="font-extrabold">
        <Money v={n.v} c={n.c} tone />
      </span>
    </span>
  );
}
