# Roadmap

Status: **Done**, **Now** (work has started), **Next**, **Later**. Each item links its issue when one exists. To propose a change to this roadmap, open a feature request.

## M0 Foundation: Done

- Public repo, AGPL-3.0 license, trademark policy, DCO sign-off
- Monorepo: web app, sync Worker, core package
- CI: lint, type check, unit and property tests, bundle size budget
- AI code review on each pull request
- Event schema and money type; balance engine with property tests

## M1 Core sharing: Now

- Done: groups, invite links, all split methods, more than one payer
- Done: settle-up with the fewest payments, payment records
- Done: multi-currency with daily ECB reference rates
- Done: device-first storage, offline queue, live sync, CSV export, install as an app
- Done: encryption of each event on the device
- Now: [Sign in with Google, Gmail only](https://github.com/unuk50/rata/issues/3)
- Now: [Design system and consistent UI](https://github.com/unuk50/rata/issues/6)
- Next: activity list, edit history, delete and restore
- Next: receipts (photos and PDFs), sealed on the device
- Next: import a CSV from another expense app
- Next: a native app on iOS and Android

## M2 Event types: Next

See [event-types.md](event-types.md).

- Event type picker and settings templates
- Home: repeating bills, default split
- Vacation: split rules (equal for all, by what each had, by family unit), shared kitty
- Family units that you can use again in other groups
- Poker: buy-in limits, rebuys, cash-out count, chip check, season table
- Party and gift pool

## M3 Insights: Later

- Share of spend by category and month
- Balance age and reminders
- Anonymous usage counters and the Private plan

## M4 My money: Later

- Card statement import on the device, with parser plugins per bank
- Link a card line to a shared expense
- The Rata skill for your own coding agent

## M5 Whole picture: Later

- Company expense claims
- Net worth and investments
