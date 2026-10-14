# Sample data and screenshots

Scripts for product review: fill a running Rata server with realistic groups, then walk every
screen on a phone-sized browser and save screenshots.

## Run

Start the app (serves the web build and the API):

```sh
pnpm --filter @rata/web build
cd apps/sync && npx wrangler dev --port 8787
```

Seed and capture in one command (it seeds first, then captures):

```sh
node scripts/sample-data/capture.mjs --base http://localhost:8787 --out .shots
```

Seed only (prints the invite links):

```sh
node scripts/sample-data/seed.mjs --base http://localhost:8787 --out .shots/seed.json
```

Options for `capture.mjs`:

| Option | Default | Use |
| --- | --- | --- |
| `--base` | `http://localhost:8787` (or `RATA_BASE`) | Server to seed and open |
| `--out` | `.shots` | Folder for PNGs, `manifest.json`, `checks.json`, `seed.json`, the CSV export |
| `--seed` | (none) | Reuse an earlier `seed.json` instead of seeding again |
| `--notes` | (none) | JSON `{ "<journey>-<screen>": ["note", ...] }` merged into the manifest observations |
| `--headed` | off | Show the browser |

Playwright is found as `PLAYWRIGHT_MODULE`, then `playwright` (via `NODE_PATH`), then
a global install. Browsers come from `PLAYWRIGHT_BROWSERS_PATH`
(default `/opt/pw-browsers`). `@rata/core` is bundled on the fly with the esbuild that Vite
installs, so no TypeScript runner is needed.

## What it makes

`data.mjs` holds five groups, all in INR as the main currency:

| Group | Kind | People | What it covers |
| --- | --- | --- | --- |
| Flat 4B, Bandra | home | 3 | 49 expenses over 3.5 months: rent by shares, bills, groceries, exact and percent splits, an edited bill, 5 payments |
| Goa trip | trip | 6 | 23 expenses: exact flights, two payers on the villa, shares, percent, subsets, a deleted duplicate, 3 payments |
| Bangkok trip | trip | 4 | INR, THB, USD and EUR expenses, a THB payment |
| Ganpati at Ishaan's | party | 8 | Two payers on catering, shares, a payment |
| Lonavala day out | other | 3 | Fully settled up |

The seed script also computes the expected balances on its own (it does not call the
ledger code in `@rata/core`), and the capture script compares them to the Balances tab.

## Output

- `NN-<journey>-<screen>.png` at 390x844, device scale 2, light theme (plus a `dark` journey).
- `manifest.json`: `{file, journey, screen, route, what_it_shows, observations}` per screenshot.
  A step that could not run has `file: null` and a `STEP FAILED` observation; the run goes on.
- `checks.json`: the balance checks per group.

The script finds elements by visible text, roles and labels, so it should keep working
after a visual redesign. If a label changes, fix the one selector named in the failed step.

Journeys: first run, join (paste, link, add yourself, broken links), group screens with
number checks (with and without exchange rates; rates are mocked for the second case),
add expense (every split method, two payers, foreign currency, errors), edit and delete,
settle up, settings (rename, add person, CSV, remove), offline, dark mode, and an offline
reload with the service worker installed.
