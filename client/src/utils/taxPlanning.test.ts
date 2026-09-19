import { describe, expect, it } from "vitest";
import { blankTaxProfile, type ComparisonResult } from "../types";
import { buildMaxedDeductionsProfile, buildProjectedProfile, computeDeductionHeadroom, marginalRateOld } from "./taxPlanning";

function fakeComparison(taxableIncomeSlabPortion: number): ComparisonResult {
  const base = {
    regime: "old" as const,
    grossTotalIncome: 0,
    standardDeduction: 0,
    totalDeductionsClaimed: 0,
    hraExemption: 0,
    taxableIncome: taxableIncomeSlabPortion,
    taxableIncomeSlabPortion,
    taxOnSlabIncome: 0,
    taxOnSpecialRateIncome: 0,
    totalTaxBeforeRebate: 0,
    rebate87A: 0,
    taxAfterRebate: 0,
    surcharge: 0,
    cess: 0,
    totalTaxLiability: 0,
    taxesPaid: 0,
    balancePayableOrRefund: 0,
  };
  return { old: base, new: { ...base, regime: "new" }, recommended: "old", savingsAmount: 0 };
}

describe("marginalRateOld", () => {
  it("returns the correct bracket for a below-60 taxpayer", () => {
    expect(marginalRateOld(200000, "below60")).toBe(0);
    expect(marginalRateOld(400000, "below60")).toBe(0.05);
    expect(marginalRateOld(800000, "below60")).toBe(0.2);
    expect(marginalRateOld(1500000, "below60")).toBe(0.3);
  });
});

describe("computeDeductionHeadroom", () => {
  it("only lists deductions with remaining room", () => {
    const profile = blankTaxProfile("2024-25");
    profile.deductions.section80C = 150000; // maxed
    profile.deductions.section80CCD1B = 20000; // 30000 remaining
    const comparison = fakeComparison(900000);
    const items = computeDeductionHeadroom(profile, comparison);
    expect(items.find((i) => i.key === "80C")).toBeUndefined();
    const ccd1b = items.find((i) => i.key === "80CCD1B");
    expect(ccd1b?.remaining).toBe(30000);
    expect(ccd1b?.estTaxSaved).toBeGreaterThan(0);
  });
});

describe("buildMaxedDeductionsProfile", () => {
  it("caps deductions at their statutory limits", () => {
    const profile = blankTaxProfile("2024-25");
    profile.ageBand = "60to80";
    profile.deductions.parentsAreSenior = true;
    const maxed = buildMaxedDeductionsProfile(profile);
    expect(maxed.deductions.section80C).toBe(150000);
    expect(maxed.deductions.section80CCD1B).toBe(50000);
    expect(maxed.deductions.section80D_self).toBe(50000); // senior citizen cap
    expect(maxed.deductions.section80D_parents).toBe(50000);
  });
});

describe("buildProjectedProfile", () => {
  it("scales salary fields by the growth factor and adds planned contributions", () => {
    const profile = blankTaxProfile("2024-25");
    profile.salary.basicPlusDA = 600000;
    profile.deductions.section80C = 100000;
    const projected = buildProjectedProfile(profile, { salaryGrowthPct: 10, extra80C: 60000, extra80CCD1B: 0 });
    expect(projected.salary.basicPlusDA).toBe(660000);
    expect(projected.deductions.section80C).toBe(150000); // capped, not 160000
  });
});
