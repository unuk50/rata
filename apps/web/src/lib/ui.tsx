import { formatMoney } from "@rata/core";
import type { ReactNode } from "react";
import { go } from "./hooks";
import type { SyncStatus } from "./sync";

export const CURRENCIES: string[] = (() => {
  const common = [
    "USD",
    "EUR",
    "GBP",
    "INR",
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

export function defaultCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const map: Record<string, string> = {
      US: "USD",
      IN: "INR",
      GB: "GBP",
      AU: "AUD",
      CA: "CAD",
      SG: "SGD",
      AE: "AED",
      JP: "JPY",
      CH: "CHF",
      NZ: "NZD",
    };
    const euro = ["DE", "FR", "ES", "IT", "NL", "IE", "PT", "BE", "AT", "FI", "GR"];
    if (region && map[region]) return map[region];
    if (region && euro.includes(region)) return "EUR";
  } catch {
    // Fall through.
  }
  return "USD";
}

export function Money({ v, c, signed }: { v: number; c: string; signed?: boolean }) {
  const cls = signed ? (v > 0 ? "text-owed" : v < 0 ? "text-owes" : "text-muted") : "";
  return <span className={`num ${cls}`}>{formatMoney(signed ? Math.abs(v) : v, c)}</span>;
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
    <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-2 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
      {back !== undefined && (
        <button
          type="button"
          className="btn-ghost -ml-2 px-2"
          onClick={() => go(back)}
          aria-label="Back"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
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
    live: ["bg-owed", "Live"],
    offline: ["bg-faint", "Offline"],
  };
  const [color, label] = map[status];
  return (
    <span
      className="caps flex items-center gap-1.5"
      title={pending ? `${pending} change(s) waiting to send` : label}
    >
      <span className={`h-2 w-2 ${color}`} />
      {label}
      {pending > 0 && ` · ${pending}`}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center border text-sm font-extrabold"
      style={{
        background: `hsl(${hue} 60% 14%)`,
        borderColor: `hsl(${hue} 70% 45%)`,
        color: `hsl(${hue} 90% 80%)`,
      }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
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

export const KINDS = [
  { id: "trip", label: "Trip", hint: "Travel with friends or family" },
  { id: "home", label: "Home", hint: "Rent, bills, groceries" },
  { id: "party", label: "Party", hint: "One evening, many guests" },
  { id: "other", label: "Other", hint: "Anything else" },
] as const;

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
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
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={value === o.id ? "tab tab-on" : "tab"}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
