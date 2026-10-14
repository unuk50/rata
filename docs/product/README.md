# Rata product direction

This folder is the public part of the Rata product plan. It tells you what Rata is, how it will grow, and what it will not do. Each pull request must link an issue or a section of this folder. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

| File | Contents |
|---|---|
| [README.md](README.md) | Vision, principles, privacy model, AI, usage data, non-goals |
| [ROADMAP.md](ROADMAP.md) | Milestones, status and the issue for each item |
| [event-types.md](event-types.md) | How each type of event changes the app |

## Vision

Share costs with family and friends, see where your money goes, and keep your data private. Free, open source, no limits and no ads.

Basic tools charge money for barebones, average features: a daily limit on expenses, ads, and a paywall on currency conversion. We are fed up with that. Rata is built first for one family that uses it every day. Anyone can use it.

## One app, two layers

| Layer | What it does | Where the data is |
|---|---|---|
| **Shared** | Groups, expenses, splits, balances, settle-up, event types | On each member's device. The sync server holds only encrypted events. |
| **My money** (later) | Your own spending, card statements, the link between a card line and a shared cost, later net worth and investments | Only on your device. It never goes to the cloud. |

## Principles

1. **Private by design.** The device encrypts each value before sync. The server cannot read amounts, names or notes. No vendor can sell or train on them.
2. **India first.** INR is the default. People settle with UPI: setup asks for a UPI ID, and "Pay" opens Google Pay or another UPI app ([#11](https://github.com/unuk50/rata/issues/11)). A trip abroad can still use other currencies. Region-specific items (bank statement parsers, price sources, payment links) stay plugins, so other countries can come later.
3. **Device first.** The app works offline and is fast. Sync runs in the background.
4. **Zero running cost.** Rata runs on free plans. A family can host its own copy for free.
5. **Zero daily work.** No servers to patch, no manual deploys. A merge to `main` deploys.
6. **Correct money.** Amounts are integers in minor units with an ISO 4217 code. Balances come from the event log. Property tests prove that each split adds up to the total.
7. **No limits and no ads.** We do not put a paywall on a basic feature.

## Sign-in

After we freeze all screens, Rata adds Google sign-in. It accepts `@gmail.com` accounts only at first. Other providers come later. Sign-in shows that a person is real. It does not give access to a group: only the group key in the invite link does that. The server keeps no user table. See [#3](https://github.com/unuk50/rata/issues/3).

## Privacy model

- Each group has a random 256-bit key. The key is in the invite link after `#`, and browsers do not send that part to a server.
- The device seals each event with AES-GCM before sync. The server stores sealed events, random IDs, time stamps and a hash of an access token.
- Each copy of Rata and each group is isolated. No data about a person or a card goes from one group or one install to another.
- "My money" never syncs.

## AI

Rata never asks for an API key and never pays for AI calls. If you use a coding agent on your computer (for example Claude Code or Codex), you can approve the Rata skill. The skill runs in your agent, on your computer, and reads your local data through a local tool. If you do not have an agent, Rata works without AI features. Simple rules on the device classify common items for everyone.

The Rata skill and its merchant knowledge base are in a separate repository under a source-available license. The app stays open source.

## Usage data

We want to learn how people use finance tools, from patterns and not from people.

- The free plan sends anonymous counters only: a screen name, a feature name, a split method. No user ID, no group ID, no amount, no merchant.
- A dashboard hides any number from fewer than 10 users.
- A low-cost "Private" plan turns the counters off. The price will be close to our cost.
- We publish the totals.

## Non-goals

- No ads, no lending, no sale of data, no product offers.
- No bank login inside Rata. Statement import reads files on your device.
- No server that can read your money data.
- No feature that only works in one country.
