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
import {
  Avatar,
  Header,
  Icon,
  IconButton,
  Money,
  Notice,
  StatusDot,
  TabPanel,
  Tabs,
} from "../lib/ui";

type Tab = "expenses" | "balances";

function dayLabel(date: string) {
  return new Date(`${date}T12:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function Group({ saved }: { saved: SavedGroup & GroupSecret }) {
  const { state, status, pending } = useGroup(saved);
  const rates = useRates();
  const [tab, setTab] = useState<Tab>("expenses");
  const g = state.group;
  const me = saved.me;
  const idx = (mid: string) =>
    Math.max(
      0,
      state.members.findIndex((m) => m.mid === mid),
    );
  const realName = (mid: string) => state.members.find((m) => m.mid === mid)?.name ?? "?";
  const name = (mid: string) => (mid === me ? "You" : realName(mid));

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
  const allPos = myNets.length > 0 && myNets.every(([, v]) => v > 0);
  const allNeg = myNets.length > 0 && myNets.every(([, v]) => v < 0);
  const empty = state.expenses.length === 0 && state.payments.length === 0;
  const heroLabel = empty
    ? "No expenses yet"
    : myNets.length === 0
      ? plan.length === 0
        ? "All settled"
        : "You're square"
      : allPos
        ? "You're owed"
        : allNeg
          ? "You owe"
          : "Your balance";
  const edge = allPos
    ? "var(--color-owed)"
    : allNeg
      ? "var(--color-owes)"
      : "var(--color-line-strong)";

  const settleLink = (t: Transfer) =>
    `/g/${saved.gid}/settle/${t.from}/${t.to}/${t.amount}/${t.currency}`;
  const myDebt = plan.find((t) => t.from === me);
  const isMine = (t: Transfer) => t.from === me || t.to === me;

  const rows = [
    ...state.expenses.map((e) => ({ kind: "e" as const, date: e.date, ts: e.ts, e })),
    ...state.payments.map((p) => ({ kind: "p" as const, date: p.date, ts: p.ts, p })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const days: { date: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last.date === r.date) last.items.push(r);
    else days.push({ date: r.date, items: [r] });
  }

  return (
    <div className="pb-28">
      <Header
        title={g?.name ?? saved.name}
        back="/"
        right={
          <>
            <StatusDot status={status} pending={pending} />
            <IconButton icon="invite" label="Invite" onClick={() => go(`/g/${saved.gid}/invite`)} />
            <IconButton
              icon="gear"
              label="Group settings"
              onClick={() => go(`/g/${saved.gid}/settings`)}
            />
          </>
        }
      />

      {!g ? (
        status === "invalid" ? (
          <Notice icon="link" text="This group is not on the server. Ask for a new invite link." />
        ) : status === "offline" ? (
          <Notice icon="wifiOff" text="You are offline. This group opens when you are online." />
        ) : (
          <p className="text-muted">Loading…</p>
        )
      ) : (
        <>
          {!empty && (
            <button
              type="button"
              className="card pop mb-5 block w-full p-5 text-left"
              style={{ "--edge": edge } as React.CSSProperties}
              onClick={() => setTab("balances")}
            >
              {myNets.length === 0 ? (
                <>
                  <div className="flex items-center gap-3 text-2xl font-extrabold text-fg-2">
                    {!empty && <Icon name="check" size={28} />} {heroLabel}
                  </div>
                  {!empty && plan.length > 0 && (
                    <div className="caps mt-2">
                      {plan.length} {plan.length === 1 ? "payment" : "payments"} open in the group
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="caps mb-1">{heroLabel}</div>
                  {myNets.map(([c, v], i) => (
                    <div
                      key={c}
                      className={`truncate leading-tight font-extrabold tracking-tight ${i === 0 ? "text-[clamp(1.75rem,9vw,3rem)]" : "text-xl"}`}
                    >
                      <Money v={v} c={c} signed={!allPos && !allNeg} tone={allPos || allNeg} />
                    </div>
                  ))}
                </>
              )}
            </button>
          )}

          <div className="mb-4">
            <Tabs
              id="gtab"
              options={[
                { id: "expenses", label: "Expenses" },
                { id: "balances", label: "Balances" },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          <TabPanel id="gtab" value={tab}>
            {tab === "expenses" &&
              (days.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-lg font-extrabold">No expenses yet</p>
                  <p className="mt-1 text-sm text-muted">Tap “Add expense” below.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {days.map((d) => (
                    <section key={d.date}>
                      <h3 className="caps mb-2">{dayLabel(d.date)}</h3>
                      <ul className="card divider">
                        {d.items.map((row) =>
                          row.kind === "e" ? (
                            <li key={row.e.eid}>
                              <button
                                type="button"
                                className="row hover:bg-raised"
                                onClick={() => go(`/g/${saved.gid}/e/${row.e.eid}`)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-bold">{row.e.desc}</div>
                                  <div className="truncate text-xs text-muted">
                                    {Object.keys(row.e.paidBy).map(name).join(", ")} ·{" "}
                                    <Money v={row.e.amount} c={row.e.currency} />
                                  </div>
                                </div>
                                <MyShare e={row.e} me={me} />
                              </button>
                            </li>
                          ) : (
                            <li key={row.p.pid}>
                              <button
                                type="button"
                                className="row hover:bg-raised"
                                onClick={() => go(`/g/${saved.gid}/p/${row.p.pid}`)}
                              >
                                <Avatar name={realName(row.p.from)} i={idx(row.p.from)} />
                                <div className="min-w-0 flex-1">
                                  <Pair from={name(row.p.from)} to={name(row.p.to)} />
                                  <div className="caps">Paid</div>
                                </div>
                                <span className="font-bold">
                                  <Money v={row.p.amount} c={row.p.currency} />
                                </span>
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    </section>
                  ))}
                </div>
              ))}

            {tab === "balances" && (
              <div className="space-y-6">
                <ul className="card divider">
                  {state.members.map((m, i) => {
                    const nets = netOf(m.mid);
                    return (
                      <li key={m.mid} className="row">
                        <Avatar name={m.name} i={i} />
                        <span className="min-w-0 flex-1 truncate font-bold">
                          {m.mid === me ? "You" : m.name}
                        </span>
                        <span className="text-right font-bold">
                          {nets.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            nets.map(([c, v]) => (
                              <div key={c}>
                                <Money v={v} c={c} signed />
                              </div>
                            ))
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <section>
                  <h3 className="caps mb-2">
                    Settle up
                    {perCurrency && <span className="text-faint"> · each currency on its own</span>}
                  </h3>
                  {plan.length === 0 ? (
                    <p className="card p-5 text-center font-bold text-muted">All settled</p>
                  ) : (
                    <ul className="card divider">
                      {[...plan]
                        .sort((a, b) => Number(isMine(b)) - Number(isMine(a)))
                        .map((t) => {
                          const mine = t.from === me || t.to === me;
                          return (
                            <li key={`${t.from}-${t.to}-${t.currency}`} className="row">
                              <Avatar name={realName(t.from)} i={idx(t.from)} />
                              <div className={`min-w-0 flex-1 ${mine ? "" : "text-fg-2"}`}>
                                <Pair from={name(t.from)} to={name(t.to)} />
                                <div
                                  className={`truncate text-lg ${mine ? "font-extrabold" : "font-semibold"}`}
                                >
                                  <Money v={t.amount} c={t.currency} />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                aria-label={`Mark paid: ${name(t.from)} to ${name(t.to)}`}
                                onClick={() => go(settleLink(t))}
                              >
                                Mark paid
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </TabPanel>

          <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="mx-auto grid max-w-xl grid-cols-[1fr_2fr] gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => (myDebt ? go(settleLink(myDebt)) : setTab("balances"))}
              >
                Settle up
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => go(`/g/${saved.gid}/add`)}
              >
                <Icon name="plus" size={18} /> Add expense
              </button>
            </div>
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
  const inIt = owed > 0 || (e.paidBy[me] ?? 0) > 0;
  if (!inIt) return <span className="caps text-faint">Not in it</span>;
  if (net === 0) return <span className="caps">Even</span>;
  return (
    <span className="text-right">
      <span className="caps block">{net > 0 ? "You get" : "You owe"}</span>
      <span className="text-sm font-extrabold">
        <Money v={net} c={e.currency} tone />
      </span>
    </span>
  );
}

/** "Aarav → Kabir", with full names so two people with one initial stay clear. */
function Pair({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
      <span className="truncate">{from}</span>
      <span className="shrink-0 text-muted">
        <Icon name="arrow" size={14} />
      </span>
      <span className="truncate">{to}</span>
    </div>
  );
}
