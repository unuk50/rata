---
name: rata-contributing
description: Use before any commit, push or pull request in the Rata repo. Every change must link a GitHub issue or a product direction in docs/product, go through a pull request, and carry a DCO sign-off.
---

# Rata contribution rules

Every change to Rata has a reason that people can see. Follow these steps for each change, also for small fixes.

## 1. Find the reason first

Before you write code, find one of these:

1. **An open issue** in `unuk50/rata` that the change does. Look with `gh issue list` or the GitHub UI.
2. **A product direction**: a section in `docs/product/` (README, ROADMAP or event-types) that the change does.

If neither exists, **open an issue first** (bug, feature or task) that says what and why, in ASD-STE100 language. Then do the work. If the change alters where the product goes, also change `docs/product/` in the same pull request, so the direction stays true.

Do not start work for a reason that only exists in a chat or in your memory.

## 2. Work on a branch, never on `main`

- Make a branch from the latest `main`. Never push to `main`.
- Commit with `git commit -s` (DCO sign-off). Each commit needs the `Signed-off-by` line.

## 3. Open a pull request with the link

Use `.github/pull_request_template.md`. The "Why" section must contain one of:

- `Closes #N` or `Fixes #N` (the merge closes the issue)
- `Refs #N` (the pull request does part of the issue)
- `Direction: docs/product/ROADMAP.md#<section>` (no issue, but a roadmap item)

The `PR link` check fails without a link. Do not remove the check or change it to pass.

## 4. Before you push

- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- UI changes follow the `rata-design` skill and `docs/design.md`.
- No real user data, emails, card numbers or amounts from real life in code, tests, issues or screenshots.
- Do not name other expense apps in public text.

## 5. After you open it

CodeRabbit reviews the pull request. Answer each comment: fix it, or say why not. A maintainer merges. Each merge to `main` deploys to production, so a pull request must be safe to ship.
