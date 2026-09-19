import { describe, expect, it } from "vitest";
import { parseForm16Input } from "./form16Parser";

describe("parseForm16Input", () => {
  it("detects gross salary, professional tax, deductions, and TDS", () => {
    const text = `
Gross Salary as per Section 17(1) 1200000
Tax on employment (Professional Tax) 2500
Deduction under Section 80C 150000
Deduction under Section 80CCD(1B) 50000
Health insurance premium under section 80D 25000
Total Amount of Tax Deducted 145000
`;
    const results = parseForm16Input(text);
    expect(results.find((r) => /gross salary/i.test(r.description))?.suggestedField).toBe("salary.basicPlusDA");
    expect(results.find((r) => /professional tax/i.test(r.description))?.suggestedField).toBe(
      "salary.professionalTax"
    );
    expect(results.find((r) => /80c\b/i.test(r.description))?.suggestedField).toBe("deductions.section80C");
    expect(results.find((r) => /80ccd/i.test(r.description))?.suggestedField).toBe("deductions.section80CCD1B");
    expect(results.find((r) => /80d/i.test(r.description))?.suggestedField).toBe("deductions.section80D_self");
    expect(results.find((r) => /tax deducted/i.test(r.description))?.suggestedField).toBe("tdsAlreadyPaid");
  });

  it("does not confuse Section 80CCD(1B) with plain 80C", () => {
    const text = "Deduction under Section 80CCD(1B) 50000";
    const results = parseForm16Input(text);
    expect(results).toHaveLength(1);
    expect(results[0].suggestedField).toBe("deductions.section80CCD1B");
  });

  it("does not map unrecognized lines to a real field", () => {
    const results = parseForm16Input("Form 16 Part B\nCertificate under section 203 of the Income Tax Act, 1961");
    expect(results.every((r) => r.suggestedField === "ignore")).toBe(true);
  });
});
