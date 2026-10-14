---
name: rata-design
description: Use for any change to the Rata web UI (screens, components, styles, icons, copy). Keeps every screen in the Rata design language, a dark system with soft borderless surfaces, flat pill buttons and sentence-case text.
---

# Rata design skill

Read `docs/design.md` before you change UI. It is the source of truth. This skill is the short checklist.

## Before you write UI code

1. Look for an existing class or component in `apps/web/src/index.css` (`@utility`) and `apps/web/src/lib/ui.tsx`. Use it.
2. If you need a new pattern, add it to `index.css` or `lib/ui.tsx` **and** to the table in `docs/design.md` in the same pull request. Do not style one screen by hand.

## Hard rules

- Colours come only from the tokens: `ink`, `panel`, `raised`, `line`, `line-strong`, `fg`, `fg-2`, `muted`, `faint`, `accent`, `on-accent`, `owed`, `owes`, `warn`, `info`. No hex values and no Tailwind palette colours (`stone-*`, `teal-*`, `gray-*` and so on) in components.
- No `rounded-*`, `border` or `shadow-*` classes in screens. Shape comes from the utilities (`card`, `field`, `tile`, `avatar`, `chip`) and the radius tokens. Buttons are flat pills; only the toast has a shadow.
- No `dark:` variants. The app is dark only.
- One `btn-primary` on each screen, for the main action. Others are `btn-secondary` or `btn-ghost`.
- Labels and section titles are sentence case and use `meta`. No tracked capitals. Amounts use `num` and weight 800 when they are the focus.
- `owed` (green) and `owes` (red) mean the direction of money only. Red also means delete or error.
- Do not use CRED names, logos, illustrations or fonts. The font is Manrope.
- UI text is in ASD-STE100: short sentences, active voice, simple words.
- Minimal text: labels of 1 to 3 words, no explainer paragraphs. If a control needs help text, redesign the control.
- People are tapped with `<PeoplePicker>`, not chosen from a `<select>`. Amounts come first and are big (`amount`). The main action is in a sticky bottom bar.
- Direction of money shows a `+` or `−` sign as well as colour. Avatars get `i={index in group}`.

## Check before you push

- `grep -rnE "stone-|gray-|teal-|rounded|shadow-|dark:|#[0-9a-fA-F]{3,6}" apps/web/src/screens apps/web/src/App.tsx` returns nothing.
- Build the web app and look at each changed screen at 390 px width. Check that the selected tab, disabled buttons and empty states are readable.
- Pressing a button or a row shrinks it a little (`press`).
- `document.documentElement.scrollWidth` equals the viewport width at 390 px (no sideways scroll), also with long names and amounts like ¥1,234,567.
- Do a blind pass: show only the screenshots to a reviewer who does not know the app, and ask what each screen is for and what they would tap first. Fix what they get wrong.
