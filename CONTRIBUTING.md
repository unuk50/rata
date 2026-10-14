# Contributing to Rata

Thank you for your help.

1. Open an issue first for a large change, so we can agree on the approach.
2. Fork the repo and make a branch.
3. Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before you push.
4. Open a pull request. CodeRabbit reviews each pull request. A maintainer merges it.

## Rules

- Money is always an integer in minor units with a currency code. Never use floats for stored amounts.
- Balances come from events. Do not store totals.
- Events are append-only. To change data, add a new event. To change an event's shape, add a new field or a new event type, and keep reading old events.
- Never send plain user data to the server. Seal it on the device.
- No real user data in tests, issues or pull requests.

## Bank statement parsers

Parsers are welcome for any bank. Use made-up sample files only.
