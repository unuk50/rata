import {
  balances,
  convertBalances,
  type GroupSecret,
  owedShares,
  type Rates,
  simplify,
  type Transfer,
} from "@rata/core";
import { useState } from "react";
import { go, useGroup, useRates } from "../lib/hooks";
import type { SavedGroup } from "../lib/storage";
import { Avatar, Header, Money, StatusDot, Tabs } from "../lib/ui";

export function Group({ saved }: { saved: SavedGroup & GroupSecret }) {
  const { state, status, pending } = useGroup(saved);
  const rates = useRates();
  const [tab, setTab] = useState<"expenses" | "balances">("expenses");
  const g = state.group;
  const name = (mid: string) => state.members.find((m) => m.mid === mid)?.name ?? "Someone";
  const me = saved.me;

  const bal = balances(state);
  const currencies = Object.keys(bal);
  const cur = g?.currency ?? "USD";
  const converted = rates ? convertBalances(bal, cur, rates.rates as Rates) : null;
  const multi = currencies.length > 1 || (currencies.length === 1 && currencies[0] !== cur);
  const plan: Transfer[] = multi
    ? converted
      ? simplify(converted, cur)
      : currencies.flatMap((c) => simplify(bal[c] ?? {}, c))
    : simplify(bal[cur] ?? {}, cur);
  const perCurrency = multi && !converted;
  const netOf = (mid: string): [string, number][] =>
    perCurrency
      ? currencies.map((c): [string, number] => [c, bal[c]?.[mid] ?? 0]).filter(([, v]) => v !== 0)
      : ([[cur, (multi ? converted?.[mid] : bal[cur]?.[mid]) ?? 0]].filter(([, v]) => v !== 0) as [
          string,
          number,
        ][]);
  const myNets = netOf(me ?? "");

  return (
    <div className="pb-28">
      <Header
        title={g?.name ?? saved.name}
        back="/"
        right={
          <div className="flex items-center gap-2">
            <StatusDot status={status} pending={pending} />
            <button
              type="button"
              className="btn-ghost px-2"
              onClick={() => go(`/g/${saved.gid}/settings`)}
              aria-label="Group settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          </div>
        }
      />

      {!g ? (
        <p className="text-muted">
          {status === "offline"
            ? "Offline. This group has not loaded on this device yet."
            : "Loading…"}
        </p>
      ) : (
        <>
          <div className="card mb-4 flex items-end justify-between p-5">
            <div>
              <div className="caps mb-1">Your balance</div>
              <div className="text-3xl font-extrabold tracking-tight">
                {myNets.length === 0 ? (
                  <span className="text-muted">Settled up</span>
                ) : (
                  myNets.map(([c, v]) => (
                    <div key={c}>
                      <Money v={v} c={c} signed />
                      <span className="caps ml-2 align-middle">
                        {v > 0 ? "owed to you" : "you owe"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => go(`/g/${saved.gid}/invite`)}
            >
              Invite
            </button>
          </div>

          <div className="mb-3">
            <Tabs
              options={[
                { id: "expenses", label: "Expenses" },
                { id: "balances", label: "Balances" },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          {tab === "expenses" && (
            <ul className="space-y-2">
              {state.expenses.length === 0 && state.payments.length === 0 && (
                <li className="card p-6 text-center text-muted">
                  No expenses yet. Add the first one.
                </li>
              )}
              {[
                ...state.expenses.map((e) => ({ kind: "e" as const, date: e.date, ts: e.ts, e })),
                ...state.payments.map((p) => ({ kind: "p" as const, date: p.date, ts: p.ts, p })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)
                .map((row) =>
                  row.kind === "e" ? (
                    <li key={row.e.eid}>
                      <button
                        type="button"
                        className="card flex w-full items-center gap-3 p-3 text-left"
                        onClick={() => go(`/g/${saved.gid}/e/${row.e.eid}`)}
                      >
                        <div className="caps w-10 shrink-0 text-center leading-tight">
                          {new Date(`${row.e.date}T12:00`).toLocaleDateString(undefined, {
                            month: "short",
                          })}
                          <div className="text-lg font-extrabold text-fg">
                            {row.e.date.slice(8)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{row.e.desc}</div>
                          <div className="truncate text-xs text-muted">
                            {Object.keys(row.e.paidBy).map(name).join(", ")} paid{" "}
                            <Money v={row.e.amount} c={row.e.currency} />
                          </div>
                        </div>
                        <MyShare e={row.e} me={me} />
                      </button>
                    </li>
                  ) : (
                    <li
                      key={row.p.pid}
                      className="card flex items-center gap-3 p-3 text-sm text-fg-2"
                    >
                      <span className="w-10 text-center" aria-hidden="true">
                        ↔
                      </span>
                      <span className="flex-1">
                        {name(row.p.from)} paid {name(row.p.to)}{" "}
                        <Money v={row.p.amount} c={row.p.currency} />
                      </span>
                    </li>
                  ),
                )}
            </ul>
          )}

          {tab === "balances" && (
            <div className="space-y-4">
              <ul className="card divider">
                {state.members.map((m) => {
                  const nets = netOf(m.mid);
                  return (
                    <li key={m.mid} className="flex items-center gap-3 p-3">
                      <Avatar name={m.name} />
                      <span className="flex-1">
                        {m.name}
                        {m.mid === me && <span className="text-faint"> (you)</span>}
                      </span>
                      {nets.length === 0 ? (
                        <span className="text-sm text-faint">settled</span>
                      ) : (
                        <span className="text-right text-sm">
                          {nets.map(([c, v]) => (
                            <div key={c}>
                              <Money v={v} c={c} signed />{" "}
                              <span className="text-xs text-muted">
                                {v > 0 ? "gets back" : "owes"}
                              </span>
                            </div>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {multi && (
                <p className="text-xs text-muted">
                  {converted
                    ? `Converted to ${cur} at ECB reference rates${rates?.date ? ` of ${rates.date}` : ""}.`
                    : "Rates are not available. Each currency settles on its own."}
                </p>
              )}
              <div>
                <h2 className="caps mb-2">Fewest payments to settle</h2>
                {plan.length === 0 ? (
                  <p className="card p-4 text-muted">Everyone is settled up.</p>
                ) : (
                  <ul className="space-y-2">
                    {plan.map((t) => (
                      <li
                        key={`${t.from}-${t.to}-${t.currency}`}
                        className="card flex items-center gap-3 p-3"
                      >
                        <span className="flex-1 text-sm">
                          <b>{name(t.from)}</b> pays <b>{name(t.to)}</b>{" "}
                          <Money v={t.amount} c={t.currency} />
                        </span>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() =>
                            go(`/g/${saved.gid}/settle/${t.from}/${t.to}/${t.amount}/${t.currency}`)
                          }
                        >
                          Record
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 flex justify-center gap-3 border-t border-line bg-ink/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => go(`/g/${saved.gid}/settle`)}
            >
              Settle up
            </button>
            <button
              type="button"
              className="btn-primary px-6"
              onClick={() => go(`/g/${saved.gid}/add`)}
            >
              + Add expense
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MyShare({
  e,
  me,
}: {
  e: Parameters<typeof owedShares>[0] & { paidBy: Record<string, number>; currency: string };
  me?: string;
}) {
  if (!me) return null;
  let owed = 0;
  try {
    owed = owedShares(e)[me] ?? 0;
  } catch {
    owed = 0;
  }
  const net = (e.paidBy[me] ?? 0) - owed;
  if (net === 0) return <span className="text-xs text-faint">not involved</span>;
  return (
    <span className="text-right text-xs">
      <div className="text-muted">{net > 0 ? "you lent" : "you owe"}</div>
      <Money v={net} c={e.currency} signed />
    </span>
  );
}
