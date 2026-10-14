/** Money is an integer count of minor units (cents, paise) plus an ISO 4217 code. */
export type Minor = number;

const exponentCache = new Map<string, number>();

/** Number of digits after the decimal point for a currency (USD 2, JPY 0, KWD 3). */
export function currencyExponent(currency: string): number {
  const cached = exponentCache.get(currency);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  exponentCache.set(currency, digits);
  return digits;
}

/** Parse user input like "1,234.5" into minor units. Returns null for invalid input. */
export function parseAmount(input: string, currency: string): Minor | null {
  const clean = input.replace(/[\s,_]/g, "");
  if (!/^\d*(\.\d*)?$/.test(clean) || clean === "" || clean === ".") return null;
  const exp = currencyExponent(currency);
  const [whole = "0", frac = ""] = clean.split(".");
  if (frac.length > exp) return null;
  const minor = Number(whole) * 10 ** exp + Number(frac.padEnd(exp, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

export function toMajor(minor: Minor, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

/** An amount for display. Whole amounts drop the zero minor units: ₹1,000, not ₹1,000.00. */
export function formatMoney(minor: Minor, currency: string, locale?: string): string {
  const whole = minor % 10 ** currencyExponent(currency) === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(toMajor(minor, currency));
}

/**
 * Split `total` into integer parts proportional to `weights` (largest remainder).
 * The parts always add up to `total`. Ties go to the earlier index, so results are stable.
 */
export function allocate(total: Minor, weights: number[]): Minor[] {
  if (!Number.isSafeInteger(total)) throw new Error("total must be an integer");
  const sum = weights.reduce((a, w) => a + w, 0);
  if (weights.length === 0 || sum <= 0) throw new Error("weights must have a positive sum");
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) throw new Error("weights must be >= 0");
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = weights.map((w) => (abs * w) / sum);
  const parts = raw.map((r) => Math.floor(r));
  let left = abs - parts.reduce((a, p) => a + p, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    const idx = order[k]?.i ?? 0;
    if ((weights[idx] ?? 0) > 0) {
      parts[idx] = (parts[idx] ?? 0) + 1;
      left--;
    }
  }
  return parts.map((p) => (p === 0 ? 0 : p * sign));
}
