# Contributing to Rata

Thank you for your help.

1. **Each change needs a reason that people can see.** Find an open issue, or a section in [docs/product/](docs/product/) that the change does. If neither exists, open an issue first.
2. Fork the repo and make a branch. Nobody pushes to `main`. Each merge to `main` deploys to production.
3. Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before you push.
4. Open a pull request. Its "Why" section must have `Closes #N`, `Refs #N` or `Direction: docs/product/<file>#<section>`. The `PR link` check fails without one.
5. CodeRabbit reviews each pull request. A maintainer merges it.

Coding agents: read [AGENTS.md](AGENTS.md) and the skills in `.claude/skills/`.

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/). Add a sign-off line to each commit with `git commit -s`. The line says that you wrote the change, or have the right to submit it, under the project license.

By contributing, you agree that your contribution is licensed under AGPL-3.0-only.

## Rules

- Money is always an integer in minor units with a currency code. Never use floats for stored amounts.
- Balances come from events. Do not store totals.
- Events are append-only. To change data, add a new event. To change an event's shape, add a new field or a new event type, and keep reading old events.
- Never send plain user data to the server. Seal it on the device.
- No real user data in tests, issues or pull requests.

## Bank statement parsers

Parsers are welcome for any bank. Use made-up sample files only.
