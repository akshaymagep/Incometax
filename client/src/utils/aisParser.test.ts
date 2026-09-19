import { describe, expect, it } from "vitest";
import { parseAisInput } from "./aisParser";

describe("parseAisInput — text mode", () => {
  it("extracts description/amount pairs from plain lines", () => {
    const text = `
Interest from savings bank account 12500
Dividend income 4300
TDS by employer 55000
`;
    const results = parseAisInput(text);
    expect(results.length).toBe(3);
    expect(results.find((r) => /savings/i.test(r.description))?.suggestedField).toBe(
      "otherSources.savingsInterest"
    );
    expect(results.find((r) => /dividend/i.test(r.description))?.suggestedField).toBe(
      "otherSources.dividendIncome"
    );
    expect(results.find((r) => /tds/i.test(r.description))?.suggestedField).toBe("tdsAlreadyPaid");
  });

  it("handles amounts with commas and currency symbols", () => {
    const text = "Interest from fixed deposit ₹1,25,000";
    const results = parseAisInput(text);
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(125000);
    expect(results[0].suggestedField).toBe("otherSources.fdInterest");
  });

  it("ignores lines with no trailing amount", () => {
    const text = "Annual Information Statement\nGenerated on 01-Apr-2024";
    expect(parseAisInput(text)).toHaveLength(0);
  });

  it("classifies long-term equity capital gains distinctly from short-term", () => {
    const text = `
Long term capital gain on equity mutual fund units 300000
Short term capital gain on listed equity shares 40000
`;
    const results = parseAisInput(text);
    expect(results.find((r) => /long/i.test(r.description))?.suggestedField).toBe("capitalGains.ltcgEquity");
    expect(results.find((r) => /short/i.test(r.description))?.suggestedField).toBe("capitalGains.stcgEquity");
  });
});

describe("parseAisInput — JSON mode", () => {
  it("walks nested JSON objects for description/amount pairs", () => {
    const json = JSON.stringify({
      TDSInformation: [
        { description: "TDS on Salary", amount: 60000 },
        { description: "TDS on Interest", amount: 2000 },
      ],
      SFTInformation: {
        entries: [{ Description: "Dividend received", Amount: "15000" }],
      },
    });
    const results = parseAisInput(json);
    expect(results.length).toBe(3);
    const salaryTds = results.find((r) => r.description === "TDS on Salary");
    expect(salaryTds?.amount).toBe(60000);
    expect(salaryTds?.suggestedField).toBe("tdsAlreadyPaid");
    const dividend = results.find((r) => r.description === "Dividend received");
    expect(dividend?.amount).toBe(15000);
  });

  it("falls back to text parsing when JSON has no recognizable pairs", () => {
    const json = JSON.stringify({ foo: "bar", nested: { x: 1 } });
    expect(parseAisInput(json)).toHaveLength(0);
  });
});
