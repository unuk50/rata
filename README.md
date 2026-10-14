# Rata

**Share costs with family and friends. Free, open source, private.**

We are fed up with basic tools that charge money for barebones, average features: a daily limit on expenses, ads, and a paywall on currency conversion. Rata has no limits and no ads, and it never reads your data.

*Rata* is short for *pro rata*: in proportion. Every split is a pro rata share.

## What works today

- Groups for a trip, a home, a party or anything else
- Invite link: people join with one tap, no account and no password
- Expenses in any currency, with split equally, by amounts, by percent or by shares
- More than one payer for one expense
- Balances, the fewest payments to settle, and payment records
- Conversion at daily ECB reference rates when a group uses more than one currency
- Live sync between devices, and full use offline
- CSV export
- Installs as an app from the browser (PWA)

## Where Rata is going

Read the [product direction](docs/product/README.md) and the [roadmap](docs/product/ROADMAP.md). Next: Google sign-in, a consistent design, event types (home, vacation, poker, party, gift pool), then a private "My money" layer that stays on your device.

## Privacy

Each group has a random 256-bit key. The key is in the invite link after the `#` sign, and browsers never send that part to a server. The device encrypts each event with AES-GCM before sync. The server stores encrypted events and a hash of an access token. It cannot read amounts, names or notes.

Lose every invite link and every device, and the group is gone. That is the cost of real privacy.

## How it works

```
apps/web        React PWA. Writes to IndexedDB first, then syncs in the background.
apps/sync       Cloudflare Worker + one SQLite Durable Object per group. Serves the web app too.
packages/core   Money type, event schema, splits, balances, settle-up plan, encryption.
docs/           Product direction (docs/product), architecture notes.
```

Money is an integer count of minor units plus an ISO 4217 code. Balances come from the event log, never from stored totals. Property tests prove that each split adds up to the total and that every group adds up to zero in each currency.

## Run it

```sh
pnpm install
pnpm --filter @rata/web build
pnpm --filter @rata/sync dev     # http://localhost:8787
pnpm test                        # unit and property tests
pnpm lint && pnpm typecheck
```

For live reload on the web app, run `pnpm --filter @rata/web dev` too and open http://localhost:5173.

## Deploy your own

Rata runs on the Cloudflare free plan. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets, and each push to `main` deploys. Or run `pnpm deploy` after `npx wrangler login`.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately: see [SECURITY.md](SECURITY.md).

## License

Rata is free software under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

In short: you can use, study, change and share Rata, also for commercial use. If you change it and run it as a service for other people, you must publish your changed source code under the same license. Keep the copyright and license notices.

The name "Rata" and the logo are not covered by this license. See [TRADEMARK.md](TRADEMARK.md).
