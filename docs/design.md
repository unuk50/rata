# Rata design language

Rata is dark, direct and fluid. It started from ideas in **NeoPOP**, the open-source design system from CRED (Apache-2.0, [github.com/CRED-CLUB/neopop-web](https://github.com/CRED-CLUB/neopop-web)): black surfaces and strong type. The 3D block look is gone. Rata now uses flat pill buttons, filled shapes and continuous lists, like the payment apps people in India use each day.

We use the ideas and the open palette only. We do not use the CRED name, logo, illustrations or proprietary fonts. Rata has its own accent colour and its own font.

![Rata screens](design/screens.png)

## Tokens

All tokens are in [`apps/web/src/index.css`](../apps/web/src/index.css) (`@theme`). Use only these tokens. Do not write a hex value or a Tailwind palette colour (for example `stone-500`) in a component.

| Token | Value | Use |
|---|---|---|
| `ink` | `#0d0d0d` | Page background |
| `panel` | `#121212` | Card |
| `raised` | `#1a1a1a` | Field, tab track |
| `raised-2` | `#232323` | Field in focus, secondary button, toast |
| `line` | white 10% | Dividers between rows |
| `line-strong` | `#3d3d3d` | Selected tab |
| `radius-surface` | 16 px | Cards, tiles, sheets |
| `radius-control` | 12 px | Fields and small controls. Buttons, tabs, chips and avatars are full pills. |
| `fg` / `fg-2` / `muted` / `faint` | white 90 / 70 / 50 / 30% | Heading / body / label / hint |
| `accent` | `#e5fe40` | The **one** main action on a screen. Selection. |
| `owed` | `#06c270` | Money comes back to you |
| `owes` | `#ee4d37` | You owe money. Delete. Errors. |
| `warn` | `#f08d32` | Syncing, warnings |

Font: **Manrope** (variable, SIL Open Font License), self-hosted. Weights: 800 for headings, buttons and labels; 700 for list titles; 400–500 for body.

## Rules

1. **Soft and borderless.** Surfaces and controls are filled shapes with the two radius tokens. No borders on cards, fields or dropdowns; a field gets lighter in focus. Avatars are round. Space follows an 8 px grid with a 16 px side gutter. Put radius and shape in `index.css` utilities, not in screens.
2. **One accent action per screen.** It uses `btn-primary`. Other actions use `btn-secondary` (grey pill) or `btn-ghost` (text only).
3. **Flat, with soft feedback.** Buttons are flat pills. On press they shrink a little (`press`). No 3D edges, no outlines. Lists run edge to edge with no boxes; day headings stick under the page header. Each row has the same leading slot: an avatar, or a category glyph for an expense.
4. **Sentence case.** Labels, section titles, tabs and buttons use sentence case. Small meta text uses `meta` (13 px, 600, `muted`). Do not use tracked capitals.
5. **Money is big and bold.** A balance uses 800 weight and tabular numbers (`num`). Green and red show only the direction of money, not decoration.
6. **Dark only.** No light theme. Contrast of body text on `ink` is at least 4.5:1.
7. **Motion is short.** 120 ms ease-out for the press (scale to 0.97). No bounce, no long fades.
8. **Text in ASD-STE100.** Short sentences, active voice, one meaning for each word.
9. **Minimal text.** Labels have 1 to 3 words. No paragraphs that explain how the app works; a lock icon with "Private" says it. If a control needs a sentence of help, change the control.
10. **Lists run edge to edge.** One row is 64 px high (`row`), with a 40 px round leading slot: a person or group letter (`<Avatar>`) or a category (`<CategoryIcon>`). No boxes or lines between rows. Tap feedback is `active:bg-panel`, never a hover colour.
11. **Line icons in the app, emoji only for the group type.** Categories use the line icons in `CATEGORY_ICON`. The only emoji are the group types on New group.
10. **Tap people, do not pick them from a list.** Use `<PeoplePicker>` for payer, split and settle. Use a `<select>` only for long lists such as currencies.
11. **Amount first.** On money screens the amount is the biggest thing (`amount`). The main action sits in a sticky bottom bar.
12. **Signs, not only colour.** Amounts that show direction have `+` or `−` as well as green or red. If a label already says the direction ("You owe"), drop the sign and keep the colour (`<Money tone>`).
13. **Colours by position.** `<Avatar i={index}>` takes its colour from the person's place in the group, so two people in one group never share a colour.
14. **Names, not only initials.** A row about two people shows both names ("Ananya → You"). Initials alone are not enough.
15. **No dead ends.** An error or empty page uses `<Notice>`: one icon, one line, one way out.
16. **Actions say what they do.** Use a verb: "Mark paid", not "Paid". Only the main action of a screen is the accent button.

## Components

| Class or component | Use |
|---|---|
| `card` | A panel for a short block of text (the privacy note). Lists do not use cards. |
| `row` | A full-width list row (avatar, text, value). |
| `btn-primary` | Accent pill button. One per screen. |
| `btn-secondary` | Grey pill button. |
| `btn-danger` | Red pill button for a destructive final step. |
| `btn-ghost` | Text button: back, delete link, low-priority actions. |
| `btn-sm` | Smaller size for buttons in a row. |
| `field`, `label` | Input, textarea, and their label. No border. |
| `field-select` | A select or date input with the field shape and a chevron. |
| `select-plain` | A select that reads as text with a chevron, for the currency above an amount. |
| `chip` | A round name chip that you can remove. |
| `toast` | The floating message bar from `toast()`. A soft shadow, no outline. |
| `bottom-bar` | The sticky action bar. It fades into the page, with no top line. |
| `day-head` | A sticky day heading in a list. |
| `qr` | The white invite QR code with soft corners. |
| `avatar` | Round 40 px leading slot: a person initial, a group kind or a category. |
| `<CategoryIcon>` | Line icon on a tinted disc for each expense category. |
| `<AmountField>` | The big centred amount with the currency sign as lists show it. |
| `<Tabs>` + `<TabPanel>` | Switch between views or split methods. The selected tab is a lighter grey pill. Give both the same `id`. |
| `<PeoplePicker>` | A row of avatars to tap. Selected avatars get an accent ring. Single or multi select. |
| `<Icon>`, `<IconButton>` | Square-cap line icons. Icon buttons are 44 × 44 px. |
| `amount` | The big amount input on money screens. |
| `person`, `person-on` | Tile styles used by `<PeoplePicker>`. |
| `btn-icon` | 44 × 44 px text-only icon button. |
| `choice`, `choice-on` | A large option tile (the group type on New group). |
| `<Avatar>` | Round initial. Pass `i` (index in the group) for a unique colour. |
| `<Money>` | Formatted amount. `signed` adds the owed and owes colour. |
| `<Header>` | Sticky screen title with back and right actions. |
| `meta`, `title`, `num` | Small sentence-case text, page title, tabular numbers. |
| `press` | The shrink on press for buttons and tappable rows. |

To add a new component, add it here and in `index.css` or `lib/ui.tsx` first, then use it.
