import { currencyExponent, formatMoney, parseAmount } from "@rata/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { go } from "./hooks";
import type { SyncStatus } from "./sync";
import { dismissToast, useToast } from "./toast";

export const CURRENCIES: string[] = (() => {
  const common = [
    "INR",
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "CAD",
    "SGD",
    "AED",
    "JPY",
    "CHF",
    "CNY",
    "HKD",
    "NZD",
    "SEK",
    "THB",
    "IDR",
    "MYR",
    "ZAR",
  ];
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
      "currency",
    );
  } catch {
    all = [];
  }
  return [...common, ...all.filter((c) => !common.includes(c))];
})();

/** Rata is for India first, so a new group starts in INR. Trips can pick another currency. */
export function defaultCurrency(): string {
  return "INR";
}

/** An amount for an input field, with thousands separators: 12,345.50. parseAmount reads it back. */
export function amountInput(minor: number, cur: string): string {
  const exp = currencyExponent(cur);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}

/** Keep a typed amount when the currency changes: 10.5 USD becomes 11 JPY, not an error. */
export function reAmount(text: string, from: string, to: string): string {
  const v = parseAmount(text, from);
  if (v === null) return text;
  const major = v / 10 ** currencyExponent(from);
  return amountInput(Math.round(major * 10 ** currencyExponent(to)), to);
}

/** The sign for a currency as lists show it (₹, $, THB), so the field and the lists agree. */
export function currencySymbol(cur: string): string {
  try {
    return formatMoney(0, cur)
      .replace(/[\d.,\s\u00a0]/g, "")
      .trim();
  } catch {
    return cur;
  }
}

/** Placeholder for an amount field: 0.00, or 0 for currencies without minor units. */
export function zero(cur: string): string {
  return (0).toFixed(currencyExponent(cur));
}

/**
 * An amount. `signed` adds + or − and the owed/owes colour.
 * `tone` keeps the colour but drops the sign, for places where a label already says the direction.
 */
export function Money({
  v,
  c,
  signed,
  tone,
}: {
  v: number;
  c: string;
  signed?: boolean;
  tone?: boolean;
}) {
  if (!signed && !tone) return <span className="num">{formatMoney(v, c)}</span>;
  const cls = v > 0 ? "text-owed" : v < 0 ? "text-owes" : "text-muted";
  const sign = tone ? "" : v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return (
    <span className={`num ${cls}`}>
      {sign}
      {formatMoney(Math.abs(v), c)}
    </span>
  );
}

const ICONS = {
  back: "M15 18l-6-6 6-6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  invite:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  wifiOff:
    "M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.6M12 20h.01",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  x: "M18 6L6 18M6 6l12 12",
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: keyof typeof ICONS;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="btn-icon" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

export function Header({
  title,
  back,
  right,
}: {
  title: ReactNode;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-1 bg-ink/90 px-2 py-1.5 backdrop-blur">
      {back !== undefined ? (
        <IconButton icon="back" label="Back" onClick={() => go(back)} />
      ) : (
        <span className="w-2" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight">{title}</h1>
      {right}
    </header>
  );
}

export function StatusDot({ status, pending }: { status: SyncStatus; pending: number }) {
  const map: Record<SyncStatus, [string, string]> = {
    loading: ["bg-faint", "Loading"],
    syncing: ["bg-warn", "Syncing"],
    live: ["bg-owed", "Synced"],
    offline: ["bg-faint", "Offline"],
    invalid: ["bg-owes", "Link not valid"],
    empty: ["bg-warn", "Waiting"],
  };
  const [color, label] = status === "live" && pending > 0 ? ["bg-warn", "Sending"] : map[status];
  // Synced is the normal state, so it shows nothing. Other states show a dot and a word.
  if (status === "live" && pending === 0) return <span className="sr-only">{label}</span>;
  if (status === "loading") return null;
  return (
    <span
      className="meta flex items-center gap-2 px-1"
      title={pending ? `${pending} change(s) waiting to send` : label}
    >
      <span className={`h-2 w-2 ${color}`} />
      <span>
        {label}
        {pending > 0 && ` · ${pending}`}
      </span>
    </span>
  );
}

// Ten colours with no green, red or lime-yellow (those mean owed, owes and selected).
// Neighbours on the wheel differ in lightness too, so close hues stay apart.
// People 11 and up reuse a colour.
const HUES = [20, 220, 295, 170, 45, 245, 320, 195, 270, 340];
const LIGHT = [44, 40, 40, 32, 48, 52, 46, 46, 56, 64];

/** Colour by position in the group, so people in one group never share a colour. */
export function Avatar({ name, i, big }: { name: string; i?: number; big?: boolean }) {
  const n = i ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = HUES[n % HUES.length] ?? 0;
  const light = LIGHT[n % HUES.length] ?? 40;
  return (
    <span
      className={`avatar ${big ? "h-12 w-12 text-lg" : "h-10 w-10 text-sm"}`}
      style={{
        background: `hsl(${hue} 50% ${light}%)`,
        color: light > 50 ? `hsl(${hue} 60% 12%)` : `hsl(${hue} 100% 94%)`,
      }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export interface Person {
  mid: string;
  name: string;
}

/** A row of people to tap. Selected tiles get the accent edge. */
export function PeoplePicker({
  people,
  selected,
  onToggle,
  me,
  label,
  indexOf,
  disabled,
}: {
  people: Person[];
  indexOf?: (mid: string) => number;
  selected: (mid: string) => boolean;
  onToggle: (mid: string) => void;
  me?: string;
  label: string;
  disabled?: (mid: string) => boolean;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const measure = () => {
    const b = ref.current;
    if (b) setEdges({ l: b.scrollLeft > 4, r: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 });
  };
  // Bring the first selected person into view, so a choice is never hidden off the edge.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the row opens
  useEffect(() => {
    // Scroll only this row, never the page.
    const box = ref.current;
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    measure();
    if (!box || !on) return;
    const b = box.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    if (r.right > b.right) box.scrollLeft += r.left - b.left - 72;
    measure();
  }, []);
  const mask = `linear-gradient(to right, ${edges.l ? "transparent, #000 2.5rem" : "#000"}, ${edges.r ? "#000 calc(100% - 2.5rem), transparent" : "#000"})`;
  return (
    <fieldset
      ref={ref}
      className="-mx-4 min-w-0 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      onScroll={measure}
      style={edges.l || edges.r ? { maskImage: mask } : undefined}
    >
      <legend className="sr-only">{label}</legend>
      <div className="flex w-max gap-1 pt-1 pr-8">
        {people.map((p, i) => {
          const on = selected(p.mid);
          const off = disabled?.(p.mid) ?? false;
          return (
            <button
              key={p.mid}
              type="button"
              aria-pressed={on}
              disabled={off}
              onClick={() => onToggle(p.mid)}
              className={`${on ? "person person-on" : "person"} ${off ? "cursor-not-allowed opacity-25 grayscale" : ""}`}
            >
              <Avatar name={p.name} i={indexOf ? indexOf(p.mid) : i} big />
              <span className="w-14 truncate text-center text-xs font-bold">
                {p.mid === me ? "You" : p.name}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The message bar from toast(). Sits above the bottom action bar. */
export function ToastBar({ raised }: { raised: boolean }) {
  const t = useToast();
  if (!t) return null;
  return (
    <output
      className={`fixed inset-x-0 z-20 block px-4 ${raised ? "bottom-24" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"}`}
    >
      <div className="toast mx-auto max-w-xl">
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.text}</span>
        {t.action && (
          <button
            type="button"
            className="min-h-11 px-2 text-sm font-bold text-accent"
            onClick={() => {
              t.action?.run();
              dismissToast();
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
    </output>
  );
}

/** A full-screen message with a way out, so no screen is a dead end. */
export function Notice({
  icon = "x",
  text,
  action = "Home",
  to = "/",
}: {
  icon?: keyof typeof ICONS;
  text: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 pt-16 text-center">
      <span className="avatar h-16 w-16 bg-raised text-fg-2">
        <Icon name={icon} size={32} />
      </span>
      <p className="max-w-72 text-lg font-bold">{text}</p>
      <button type="button" className="btn-secondary" onClick={() => go(to)}>
        {action}
      </button>
    </div>
  );
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const CATEGORIES = [
  "General",
  "Food",
  "Groceries",
  "Travel",
  "Transport",
  "Stay",
  "Fun",
  "Shopping",
  "Bills",
  "Rent",
  "Health",
  "Gifts",
  "Other",
];

/** One line icon and one hue for each category, for the leading slot of an expense row. */
export const CATEGORY_ICON: Record<string, { d: string; hue: number }> = {
  General: { d: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", hue: 220 },
  Food: { d: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11", hue: 24 },
  Groceries: { d: "M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01", hue: 160 },
  Travel: {
    d: "M10 14l-6 3v-2l6-5V5a2 2 0 0 1 4 0v5l6 5v2l-6-3v4l2 2v1l-4-1-4 1v-1l2-2z",
    hue: 195,
  },
  Transport: { d: "M5 16V9l2-4h10l2 4v7zM5 16v3M19 16v3M5 11h14M8 13.5h.01M16 13.5h.01", hue: 205 },
  Stay: { d: "M3 19V6M3 12h18v7M21 19v-4a3 3 0 0 0-3-3h-7v0M7 9h.01", hue: 262 },
  Fun: { d: "M4 8V5h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 5v10", hue: 330 },
  Shopping: { d: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2", hue: 290 },
  Bills: { d: "M13 3L5 14h6l-1 7 8-11h-6z", hue: 44 },
  Rent: { d: "M3 11l9-7 9 7M5 9v11h14V9M10 20v-6h4v6", hue: 172 },
  Health: { d: "M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z", hue: 350 },
  Gifts: {
    d: "M4 10h16v4H4zM6 14h12v7H6zM12 10v11M12 10c-2-4-6-4-6-1s6 1 6 1c2-4 6-4 6-1s-6 1-6 1",
    hue: 310,
  },
  Other: { d: "M6 12h.01M12 12h.01M18 12h.01", hue: 235 },
};

/** The leading slot of an expense row: the category icon on a tinted disc. */
export function CategoryIcon({ c }: { c?: string }) {
  const k = c && CATEGORY_ICON[c] ? c : "General";
  const { d, hue } = CATEGORY_ICON[k] ?? { d: "", hue: 0 };
  return (
    <span
      className="avatar h-10 w-10"
      style={{ background: `hsl(${hue} 35% 24%)`, color: `hsl(${hue} 90% 80%)` }}
      aria-hidden="true"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

/**
 * The big amount, with the currency sign in front. A hidden copy of the text sets the width,
 * so sign and digits stay together in the centre at any length.
 */
export function AmountField({
  id,
  cur,
  value,
  onChange,
  onBlur,
  autoFocus,
}: {
  id?: string;
  cur: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  // A letter code (THB) is already on the picker above, so only a symbol (₹, $, ¥) shows here.
  const sym = /\p{L}{2,}/u.test(currencySymbol(cur)) ? "" : currencySymbol(cur);
  return (
    <div className="flex max-w-full items-baseline justify-center gap-2">
      {sym && (
        <span className="shrink-0 text-4xl font-extrabold text-muted" aria-hidden="true">
          {sym}
        </span>
      )}
      <span className="inline-grid min-w-0">
        <span
          className="amount invisible col-start-1 row-start-1 whitespace-pre"
          aria-hidden="true"
        >
          {value || zero(cur)}
        </span>
        <input
          id={id}
          className="amount col-start-1 row-start-1 w-full"
          size={1}
          inputMode="decimal"
          placeholder={zero(cur)}
          aria-label="Amount"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus={autoFocus}
        />
      </span>
    </div>
  );
}

export const KINDS = [
  { id: "trip", label: "Trip", emoji: "\u2708\ufe0f" },
  { id: "home", label: "Home", emoji: "\ud83c\udfe0" },
  { id: "party", label: "Party", emoji: "\ud83c\udf89" },
  { id: "other", label: "Other", emoji: "\u2728" },
] as const;

export function Tabs<T extends string>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="tabs"
      role="tablist"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          id={`${id}-tab-${o.id}`}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          aria-controls={`${id}-panel`}
          onClick={() => onChange(o.id)}
          className={value === o.id ? "tab tab-on" : "tab"}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  value,
  children,
}: {
  id: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`}>
      {children}
    </div>
  );
}
