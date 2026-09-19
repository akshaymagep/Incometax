import { describe, expect, it } from "vitest";
import { calcHRAExemption, compareRegimes, computeRegime } from "./taxEngine.js";
import type { TaxProfile } from "../types.js";

function blankProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
  return {
    financialYear: "2024-25",
    ageBand: "below60",
    salary: {
      basicPlusDA: 0,
      hraReceived: 0,
      rentPaid: 0,
      isMetro: false,
      otherAllowances: 0,
      employerNpsContribution: 0,
    },
    houseProperty: {
      isSelfOccupied: true,
      annualRentReceived: 0,
      municipalTaxesPaid: 0,
      homeLoanInterest: 0,
    },
    capitalGains: { stcgEquity: 0, ltcgEquity: 0, stcgOther: 0, ltcgOther: 0 },
    otherSources: { savingsInterest: 0, fdInterest: 0, dividendIncome: 0, otherIncome: 0 },
    business: { netProfit: 0 },
    deductions: {
      section80C: 0,
      section80CCD1B: 0,
      section80D_self: 0,
      section80D_parents: 0,
      parentsAreSenior: false,
      section80TTA_TTB: 0,
      section80G: 0,
      section80E: 0,
      otherDeductions: 0,
    },
    tdsAlreadyPaid: 0,
    advanceTaxPaid: 0,
    ...overrides,
  };
}

describe("calcHRAExemption", () => {
  it("returns 0 when no rent is paid", () => {
    const salary = {
      basicPlusDA: 600000,
      hraReceived: 240000,
      rentPaid: 0,
      isMetro: true,
      otherAllowances: 0,
      employerNpsContribution: 0,
    };
    expect(calcHRAExemption(salary)).toBe(0);
  });

  it("takes the least of the three HRA rules for a metro city", () => {
    const salary = {
      basicPlusDA: 600000, // 10% = 60000; 50% = 300000
      hraReceived: 240000,
      rentPaid: 300000, // excess over 10% basic = 240000
      isMetro: true,
      otherAllowances: 0,
      employerNpsContribution: 0,
    };
    // least(240000 received, 240000 excess rent, 300000 @ 50%) = 240000
    expect(calcHRAExemption(salary)).toBe(240000);
  });

  it("uses 40% of basic for non-metro cities", () => {
    const salary = {
      basicPlusDA: 600000, // 40% = 240000
      hraReceived: 300000,
      rentPaid: 300000, // excess over 10% = 240000
      isMetro: false,
      otherAllowances: 0,
      employerNpsContribution: 0,
    };
    expect(calcHRAExemption(salary)).toBe(240000);
  });
});

describe("computeRegime - zero income", () => {
  it("produces zero tax liability", () => {
    const result = computeRegime(blankProfile(), "old");
    expect(result.totalTaxLiability).toBe(0);
    expect(result.balancePayableOrRefund).toBe(0);
  });
});

describe("computeRegime - old regime rebate under Sec 87A", () => {
  it("gives full rebate for taxable income at 5,00,000", () => {
    const profile = blankProfile({
      salary: {
        basicPlusDA: 550000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
    });
    // gross salary 550000 - std ded 50000 = 500000 taxable
    const result = computeRegime(profile, "old");
    expect(result.taxableIncomeSlabPortion).toBe(500000);
    expect(result.rebate87A).toBeGreaterThan(0);
    expect(result.totalTaxLiability).toBe(0);
  });

  it("charges tax once taxable income exceeds 5,00,000", () => {
    const profile = blankProfile({
      salary: {
        basicPlusDA: 650000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
    });
    // taxable salary = 600000; tax = 0 (2.5L) + 5%*2.5L = 12500; no rebate (>5L)
    const result = computeRegime(profile, "old");
    expect(result.taxableIncomeSlabPortion).toBe(600000);
    expect(result.rebate87A).toBe(0);
    expect(result.totalTaxLiability).toBeGreaterThan(0);
  });
});

describe("computeRegime - new regime rebate under Sec 87A", () => {
  it("zeroes out tax for taxable income up to 7,00,000", () => {
    const profile = blankProfile({
      salary: {
        basicPlusDA: 775000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
    });
    // gross 775000 - std ded 75000 = 700000
    const result = computeRegime(profile, "new");
    expect(result.taxableIncomeSlabPortion).toBe(700000);
    expect(result.totalTaxLiability).toBe(0);
  });
});

describe("computeRegime - deductions only apply in old regime", () => {
  it("ignores 80C in the new regime but applies it in the old regime", () => {
    const profile = blankProfile({
      salary: {
        basicPlusDA: 1200000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
      deductions: {
        section80C: 150000,
        section80CCD1B: 0,
        section80D_self: 0,
        section80D_parents: 0,
        parentsAreSenior: false,
        section80TTA_TTB: 0,
        section80G: 0,
        section80E: 0,
        otherDeductions: 0,
      },
    });
    const oldResult = computeRegime(profile, "old");
    const newResult = computeRegime(profile, "new");
    expect(oldResult.totalDeductionsClaimed).toBe(150000);
    expect(newResult.totalDeductionsClaimed).toBe(0);
  });
});

describe("computeRegime - capital gains special rates", () => {
  it("taxes LTCG equity only above the 1,25,000 exemption at 12.5%", () => {
    const profile = blankProfile({
      capitalGains: { stcgEquity: 0, ltcgEquity: 225000, stcgOther: 0, ltcgOther: 0 },
    });
    const result = computeRegime(profile, "old");
    expect(result.taxOnSpecialRateIncome).toBeCloseTo(100000 * 0.125, 2);
  });

  it("taxes STCG equity at a flat 20%", () => {
    const profile = blankProfile({
      capitalGains: { stcgEquity: 100000, ltcgEquity: 0, stcgOther: 0, ltcgOther: 0 },
    });
    const result = computeRegime(profile, "old");
    expect(result.taxOnSpecialRateIncome).toBeCloseTo(20000, 2);
  });
});

describe("computeRegime - self-occupied home loan interest", () => {
  it("caps the interest deduction at 2,00,000 in the old regime", () => {
    const profile = blankProfile({
      houseProperty: {
        isSelfOccupied: true,
        annualRentReceived: 0,
        municipalTaxesPaid: 0,
        homeLoanInterest: 350000,
      },
      salary: {
        basicPlusDA: 1500000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
    });
    const result = computeRegime(profile, "old");
    // taxable salary = 1500000 - 50000 = 1450000; minus 200000 capped HP loss = 1250000
    expect(result.taxableIncomeSlabPortion).toBe(1250000);
  });

  it("disallows self-occupied home loan interest in the new regime", () => {
    const profile = blankProfile({
      houseProperty: {
        isSelfOccupied: true,
        annualRentReceived: 0,
        municipalTaxesPaid: 0,
        homeLoanInterest: 350000,
      },
      salary: {
        basicPlusDA: 1500000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
    });
    const result = computeRegime(profile, "new");
    expect(result.taxableIncomeSlabPortion).toBe(1500000 - 75000);
  });
});

describe("compareRegimes", () => {
  it("recommends the regime with lower total tax liability", () => {
    const profile = blankProfile({
      salary: {
        basicPlusDA: 900000,
        hraReceived: 0,
        rentPaid: 0,
        isMetro: false,
        otherAllowances: 0,
        employerNpsContribution: 0,
      },
      deductions: {
        section80C: 150000,
        section80CCD1B: 50000,
        section80D_self: 25000,
        section80D_parents: 0,
        parentsAreSenior: false,
        section80TTA_TTB: 0,
        section80G: 0,
        section80E: 0,
        otherDeductions: 0,
      },
    });
    const comparison = compareRegimes(profile);
    expect(["old", "new"]).toContain(comparison.recommended);
    expect(comparison.savingsAmount).toBeGreaterThanOrEqual(0);
    const cheaper = comparison.recommended === "old" ? comparison.old : comparison.new;
    const other = comparison.recommended === "old" ? comparison.new : comparison.old;
    expect(cheaper.totalTaxLiability).toBeLessThanOrEqual(other.totalTaxLiability);
  });
});
