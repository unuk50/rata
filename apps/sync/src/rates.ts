/** Parse the ECB daily XML: units of each currency for 1 EUR. */
export function parseEcb(xml: string): { date: string | null; rates: Record<string, number> } {
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1] ?? null;
  const rates: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    if (m[1] && m[2]) rates[m[1]] = Number(m[2]);
  }
  return { date, rates };
}
