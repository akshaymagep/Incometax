import { describe, expect, it } from "vitest";
import { compareRegimes } from "./taxEngine.js";
import {
  buildDraftItr1,
  buildDraftItr4,
  buildFilingWorksheet,
  computePresumptiveDetails,
  determineApplicableForm,
} from "./itrExport.js";
import type { TaxProfile } from "../types.js";

function blankProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
  return {
    financialYear: "2024-25",
    ageBand: "below60",
    personalInfo: { fullName: "Test User", pan: "ABCDE1234F", dateOfBirth: "1990-01-01", residentialStatus: "resident" },
    salary: {
      basicPlusDA: 0,
      hraReceived: 0,
      rentPaid: 0,
      isMetro: false,
      otherAllowances: 0,
      employerNpsContribution: 0,
      professionalTax: 0,
    },
    houseProperty: { isSelfOccupied: true, annualRentReceived: 0, municipalTaxesPaid: 0, homeLoanInterest: 0 },
    capitalGains: { stcgEquity: 0, ltcgEquity: 0, stcgOther: 0, ltcgOther: 0 },
    otherSources: { savingsInterest: 0, fdInterest: 0, dividendIncome: 0, otherIncome: 0 },
    business: { netProfit: 0, presumptiveScheme: "none", turnoverOrGrossReceipts: 0, digitalReceiptsMostly: false },
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

describe("determineApplicableForm", () => {
  it("picks ITR-1 for a simple resident salaried profile", () => {
    const result = determineApplicableForm(blankProfile({ salary: { ...blankProfile().salary, basicPlusDA: 800000 } }));
    expect(result.form).toBe("ITR-1");
  });

  it("picks ITR-2 when capital gains are present", () => {
    const result = determineApplicableForm(
      blankProfile({ capitalGains: { stcgEquity: 50000, ltcgEquity: 0, stcgOther: 0, ltcgOther: 0 } })
    );
    expect(result.form).toBe("ITR-2");
  });

  it("picks ITR-3 when business income is present", () => {
    const result = determineApplicableForm(blankProfile({ business: { netProfit: 200000, presumptiveScheme: "none", turnoverOrGrossReceipts: 0, digitalReceiptsMostly: false } }));
    expect(result.form).toBe("ITR-3");
  });

  it("picks ITR-2 for non-residents even without capital gains", () => {
    const result = determineApplicableForm(
      blankProfile({ personalInfo: { ...blankProfile().personalInfo, residentialStatus: "nonResident" } })
    );
    expect(result.form).toBe("ITR-2");
  });
});

describe("computePresumptiveDetails", () => {
  it("uses the 6% digital rate and 3 crore limit for 44AD with mostly digital receipts", () => {
    const details = computePresumptiveDetails({
      netProfit: 600000,
      presumptiveScheme: "44AD",
      turnoverOrGrossReceipts: 10000000,
      digitalReceiptsMostly: true,
    });
    expect(details?.rate).toBe(0.06);
    expect(details?.turnoverLimit).toBe(30000000);
    expect(details?.minimumPresumptiveProfit).toBe(600000);
    expect(details?.withinTurnoverLimit).toBe(true);
    expect(details?.meetsMinimumProfit).toBe(true);
  });

  it("uses the 8% cash rate and 2 crore limit for 44AD without mostly digital receipts", () => {
    const details = computePresumptiveDetails({
      netProfit: 100000,
      presumptiveScheme: "44AD",
      turnoverOrGrossReceipts: 5000000,
      digitalReceiptsMostly: false,
    });
    expect(details?.rate).toBe(0.08);
    expect(details?.turnoverLimit).toBe(20000000);
    expect(details?.minimumPresumptiveProfit).toBe(400000);
    expect(details?.meetsMinimumProfit).toBe(false); // declared 100000 < minimum 400000
  });

  it("uses the flat 50% rate for 44ADA", () => {
    const details = computePresumptiveDetails({
      netProfit: 1000000,
      presumptiveScheme: "44ADA",
      turnoverOrGrossReceipts: 2000000,
      digitalReceiptsMostly: false,
    });
    expect(details?.rate).toBe(0.5);
    expect(details?.turnoverLimit).toBe(5000000);
    expect(details?.minimumPresumptiveProfit).toBe(1000000);
  });

  it("returns null when no scheme is selected", () => {
    expect(
      computePresumptiveDetails({ netProfit: 0, presumptiveScheme: "none", turnoverOrGrossReceipts: 0, digitalReceiptsMostly: false })
    ).toBeNull();
  });
});

describe("determineApplicableForm — ITR-4", () => {
  it("picks ITR-4 for a valid presumptive 44AD profile", () => {
    const profile = blankProfile({
      business: { netProfit: 800000, presumptiveScheme: "44AD", turnoverOrGrossReceipts: 10000000, digitalReceiptsMostly: true },
    });
    const comparison = compareRegimes(profile);
    const result = determineApplicableForm(profile, comparison);
    expect(result.form).toBe("ITR-4");
  });

  it("falls back to ITR-3 when turnover exceeds the presumptive limit", () => {
    const profile = blankProfile({
      business: { netProfit: 3000000, presumptiveScheme: "44AD", turnoverOrGrossReceipts: 50000000, digitalReceiptsMostly: true },
    });
    const comparison = compareRegimes(profile);
    const result = determineApplicableForm(profile, comparison);
    expect(result.form).toBe("ITR-3");
    expect(result.reasons.join(" ")).toMatch(/exceed/i);
  });

  it("falls back to ITR-3 when declared profit is below the presumptive minimum", () => {
    const profile = blankProfile({
      business: { netProfit: 50000, presumptiveScheme: "44AD", turnoverOrGrossReceipts: 5000000, digitalReceiptsMostly: false },
    });
    const comparison = compareRegimes(profile);
    const result = determineApplicableForm(profile, comparison);
    expect(result.form).toBe("ITR-3");
    expect(result.reasons.join(" ")).toMatch(/below the Section 44AD minimum/i);
  });

  it("picks ITR-3 (not ITR-4) when both presumptive business income and capital gains are present", () => {
    const profile = blankProfile({
      business: { netProfit: 800000, presumptiveScheme: "44AD", turnoverOrGrossReceipts: 10000000, digitalReceiptsMostly: true },
      capitalGains: { stcgEquity: 50000, ltcgEquity: 0, stcgOther: 0, ltcgOther: 0 },
    });
    const comparison = compareRegimes(profile);
    const result = determineApplicableForm(profile, comparison);
    expect(result.form).toBe("ITR-3");
  });
});

describe("buildDraftItr4", () => {
  it("returns null when the profile is not ITR-4 eligible", () => {
    const profile = blankProfile({ business: { netProfit: 200000, presumptiveScheme: "none", turnoverOrGrossReceipts: 0, digitalReceiptsMostly: false } });
    const comparison = compareRegimes(profile);
    expect(buildDraftItr4(profile, comparison)).toBeNull();
  });

  it("builds a draft for a valid presumptive profile", () => {
    const profile = blankProfile({
      business: { netProfit: 800000, presumptiveScheme: "44AD", turnoverOrGrossReceipts: 10000000, digitalReceiptsMostly: true },
    });
    const comparison = compareRegimes(profile);
    const draft = buildDraftItr4(profile, comparison);
    expect(draft).not.toBeNull();
    expect(draft?.ITR.ITR4.ScheduleBP_PresumptiveIncome.DeclaredProfit).toBe(800000);
    expect(draft?.ITR.ITR4.ScheduleBP_PresumptiveIncome.Section).toBe("44AD");
    expect(draft?._disclaimer).toMatch(/DRAFT/);
  });
});

describe("buildFilingWorksheet", () => {
  it("includes both regime worksheets and the applicable form", () => {
    const profile = blankProfile({ salary: { ...blankProfile().salary, basicPlusDA: 900000 } });
    const comparison = compareRegimes(profile);
    const worksheet = buildFilingWorksheet(profile, comparison);
    expect(worksheet.applicableForm).toBe("ITR-1");
    expect(worksheet.oldRegimeWorksheet.partB_TTI_ComputationOfTaxLiability.totalTaxLiability).toBe(
      comparison.old.totalTaxLiability
    );
    expect(worksheet.newRegimeWorksheet.partB_TTI_ComputationOfTaxLiability.totalTaxLiability).toBe(
      comparison.new.totalTaxLiability
    );
    expect(worksheet.partA_GeneralInformation.pan).toBe("ABCDE1234F");
  });
});

describe("buildDraftItr1", () => {
  it("returns null when the profile is not ITR-1 eligible", () => {
    const profile = blankProfile({ business: { netProfit: 100000, presumptiveScheme: "none", turnoverOrGrossReceipts: 0, digitalReceiptsMostly: false } });
    const comparison = compareRegimes(profile);
    expect(buildDraftItr1(profile, comparison)).toBeNull();
  });

  it("builds a draft for a simple salaried profile", () => {
    const profile = blankProfile({ salary: { ...blankProfile().salary, basicPlusDA: 900000 } });
    const comparison = compareRegimes(profile);
    const draft = buildDraftItr1(profile, comparison);
    expect(draft).not.toBeNull();
    expect(draft?.ITR.ITR1.PartA_GEN1.PersonalInfo.PAN).toBe("ABCDE1234F");
    expect(draft?._disclaimer).toMatch(/DRAFT/);
  });

  it("computes IncomeFromSal as salary income net of standard deduction, not a leftover of GTI arithmetic", () => {
    const profile = blankProfile({ salary: { ...blankProfile().salary, basicPlusDA: 900000 } });
    const comparison = compareRegimes(profile);
    const draft = buildDraftItr1(profile, comparison);
    const recommendedRegime = comparison.recommended;
    const expectedStandardDeduction = recommendedRegime === "new" ? 75000 : 50000;
    expect(draft?.ITR.ITR1.ITR1_IncomeDeductions.IncomeFromSal).toBe(900000 - expectedStandardDeduction);
    expect(draft?.ITR.ITR1.ITR1_IncomeDeductions.GrossSalary).toBe(900000);
  });
});
