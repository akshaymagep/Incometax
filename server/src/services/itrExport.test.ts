import { describe, expect, it } from "vitest";
import { compareRegimes } from "./taxEngine.js";
import { buildDraftItr1, buildFilingWorksheet, determineApplicableForm } from "./itrExport.js";
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
    },
    houseProperty: { isSelfOccupied: true, annualRentReceived: 0, municipalTaxesPaid: 0, homeLoanInterest: 0 },
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
    const result = determineApplicableForm(blankProfile({ business: { netProfit: 200000 } }));
    expect(result.form).toBe("ITR-3");
  });

  it("picks ITR-2 for non-residents even without capital gains", () => {
    const result = determineApplicableForm(
      blankProfile({ personalInfo: { ...blankProfile().personalInfo, residentialStatus: "nonResident" } })
    );
    expect(result.form).toBe("ITR-2");
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
    const profile = blankProfile({ business: { netProfit: 100000 } });
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
