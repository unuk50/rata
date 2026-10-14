import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEcb } from "../src/rates";

describe("parseEcb", () => {
  it("reads the date and rates from the ECB daily file", () => {
    const xml = readFileSync(new URL("./ecb-sample.xml", import.meta.url), "utf8");
    const r = parseEcb(xml);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.rates.EUR).toBe(1);
    expect(r.rates.USD).toBeGreaterThan(0.5);
    expect(r.rates.INR).toBeGreaterThan(50);
    expect(r.rates.JPY).toBe(160.21);
  });
});
