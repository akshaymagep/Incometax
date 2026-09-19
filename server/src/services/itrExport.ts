import type { BusinessIncome, ComparisonResult, RegimeResult, TaxProfile } from "../types.js";
import { computeSalaryHead } from "./taxEngine.js";

/**
 * Filing-export helpers.
 *
 * IMPORTANT: The Income Tax Department's offline utility produces a JSON file with a proprietary
 * schema (exact field names, a "Digest"/checksum block, and internal validations) that changes
 * every assessment year. We don't have access to that authoritative schema at build time, so:
 *
 *  - `buildFilingWorksheet` is always safe to generate: it organizes the user's numbers under the
 *    same schedule names the ITR forms and the portal use (Schedule S, HP, CG, OS, VI-A,
 *    Part B-TI, Part B-TTI) so a person can transcribe them into the portal or the offline
 *    utility quickly and correctly.
 *  - `buildDraftItr1` produces a best-effort, ITR-1-shaped JSON for the common salaried case. It
 *    is explicitly labeled as a draft/reference file. It is NOT guaranteed to be byte-for-byte
 *    compatible with the current offline utility schema and may be rejected if uploaded as-is —
 *    users should cross-check it against (or rebuild it inside) the official utility before
 *    relying on it.
 */

export type ApplicableForm = "ITR-1" | "ITR-2" | "ITR-3" | "ITR-4";

export interface FormApplicability {
  form: ApplicableForm;
  reasons: string[];
}

export interface PresumptiveDetails {
  scheme: "44AD" | "44ADA";
  rate: number;
  turnoverLimit: number;
  minimumPresumptiveProfit: number;
  withinTurnoverLimit: boolean;
  meetsMinimumProfit: boolean;
}

/** Section 44AD (business) / 44ADA (profession) presumptive-scheme math, used both for ITR-4
 * eligibility and to help the user see the minimum profit they'd need to declare. */
export function computePresumptiveDetails(business: BusinessIncome): PresumptiveDetails | null {
  if (business.presumptiveScheme === "none") return null;
  const digital = business.digitalReceiptsMostly;
  const scheme = business.presumptiveScheme;
  const rate = scheme === "44AD" ? (digital ? 0.06 : 0.08) : 0.5;
  const turnoverLimit = scheme === "44AD" ? (digital ? 30000000 : 20000000) : digital ? 7500000 : 5000000;
  const minimumPresumptiveProfit = Math.round(business.turnoverOrGrossReceipts * rate);
  return {
    scheme,
    rate,
    turnoverLimit,
    minimumPresumptiveProfit,
    withinTurnoverLimit: business.turnoverOrGrossReceipts > 0 && business.turnoverOrGrossReceipts <= turnoverLimit,
    meetsMinimumProfit: business.netProfit >= minimumPresumptiveProfit,
  };
}

const ITR4_TOTAL_INCOME_LIMIT = 5000000; // Sec 44AD/44ADA (Sugam) eligibility caps total income at Rs.50 lakh

export function determineApplicableForm(profile: TaxProfile, comparison?: ComparisonResult): FormApplicability {
  const reasons: string[] = [];
  const hasCapitalGains =
    profile.capitalGains.stcgEquity > 0 ||
    profile.capitalGains.ltcgEquity > 0 ||
    profile.capitalGains.stcgOther > 0 ||
    profile.capitalGains.ltcgOther > 0;
  const hasBusinessIncome = profile.business.netProfit !== 0 || profile.business.turnoverOrGrossReceipts > 0;
  const isNonResident = profile.personalInfo.residentialStatus !== "resident";

  if (hasBusinessIncome) {
    if (hasCapitalGains) {
      reasons.push(
        "Business/professional income together with capital gains requires ITR-3 — ITR-4 doesn't cover capital gains."
      );
      return { form: "ITR-3", reasons };
    }
    if (isNonResident) {
      reasons.push("ITR-4 is only available to resident individuals — ITR-3 applies instead.");
      return { form: "ITR-3", reasons };
    }
    const presumptive = computePresumptiveDetails(profile.business);
    const totalIncome = comparison ? comparison[comparison.recommended].grossTotalIncome : undefined;
    const withinIncomeLimit = totalIncome === undefined || totalIncome <= ITR4_TOTAL_INCOME_LIMIT;
    if (presumptive && presumptive.withinTurnoverLimit && presumptive.meetsMinimumProfit && withinIncomeLimit) {
      reasons.push(
        `Presumptive taxation under Section ${presumptive.scheme} was selected, within the ₹${presumptive.turnoverLimit.toLocaleString(
          "en-IN"
        )} turnover limit, with declared profit at or above the ${Math.round(presumptive.rate * 100)}% minimum.`
      );
      return { form: "ITR-4", reasons };
    }
    if (presumptive && !presumptive.withinTurnoverLimit) {
      reasons.push(
        `Turnover/receipts exceed the Section ${presumptive.scheme} presumptive limit — ITR-3 (with regular books of account) applies instead.`
      );
    } else if (presumptive && !presumptive.meetsMinimumProfit) {
      reasons.push(
        `Declared profit is below the Section ${presumptive.scheme} minimum (${Math.round(
          presumptive.rate * 100
        )}% of turnover/receipts) — presumptive taxation doesn't apply, so ITR-3 (with regular books of account) applies instead.`
      );
    } else if (!withinIncomeLimit) {
      reasons.push("Total income exceeds ₹50 lakh — ITR-4 (Sugam) isn't available above that threshold.");
    } else {
      reasons.push("Business/professional income was entered without opting for presumptive taxation.");
    }
    return { form: "ITR-3", reasons };
  }
  if (hasCapitalGains) {
    reasons.push("Capital gains were entered — ITR-1 does not cover capital gains.");
    return { form: "ITR-2", reasons };
  }
  if (isNonResident) {
    reasons.push("ITR-1 is only available to resident individuals.");
    return { form: "ITR-2", reasons };
  }
  reasons.push("Only salary, one house property, and other-sources income were entered, for a resident individual.");
  return { form: "ITR-1", reasons };
}

function regimeWorksheet(result: RegimeResult, profile: TaxProfile) {
  const salaryHead = computeSalaryHead(profile.salary, result.regime);
  return {
    scheduleS_Salary: {
      grossSalary: salaryHead.grossSalary,
      allowancesExemptUs10_HRA: salaryHead.hraExemption,
      section80CCD2_EmployerNPS: salaryHead.section80CCD2,
      standardDeduction: salaryHead.standardDeduction,
      incomeChargeableUnderHeadSalary: salaryHead.taxableSalary,
      note: "Section 10 exemptions (HRA) and Chapter VI-A deductions apply only under the old regime; the salary standard deduction and 80CCD(2) apply to both.",
    },
    scheduleHP_HouseProperty: {
      typeOfHouseProperty: profile.houseProperty.isSelfOccupied ? "Self-occupied" : "Let-out",
      annualRentReceived: profile.houseProperty.annualRentReceived,
      municipalTaxesPaid: profile.houseProperty.municipalTaxesPaid,
      interestOnBorrowedCapital_Sec24b: profile.houseProperty.homeLoanInterest,
      note:
        result.regime === "new" && profile.houseProperty.isSelfOccupied
          ? "Self-occupied home loan interest is not deductible under the new regime."
          : undefined,
    },
    scheduleCG_CapitalGains: {
      stcgListedEquity_Sec111A: profile.capitalGains.stcgEquity,
      ltcgListedEquity_Sec112A: profile.capitalGains.ltcgEquity,
      ltcgExemptionApplied: Math.min(profile.capitalGains.ltcgEquity, 125000),
      stcgOther_TaxedAtSlab: profile.capitalGains.stcgOther,
      ltcgOther_Flat12_5pct: profile.capitalGains.ltcgOther,
    },
    scheduleOS_OtherSources: {
      savingsInterest: profile.otherSources.savingsInterest,
      fdInterest: profile.otherSources.fdInterest,
      dividendIncome: profile.otherSources.dividendIncome,
      otherIncome: profile.otherSources.otherIncome,
      deduction80TTA_80TTB: result.regime === "old" ? undefined : 0,
    },
    scheduleBP_BusinessOrProfession:
      profile.business.netProfit !== 0 || profile.business.turnoverOrGrossReceipts > 0
        ? (() => {
            const presumptive = computePresumptiveDetails(profile.business);
            return {
              declaredNetProfit: profile.business.netProfit,
              presumptiveScheme: profile.business.presumptiveScheme,
              turnoverOrGrossReceipts: profile.business.turnoverOrGrossReceipts,
              ...(presumptive
                ? {
                    presumptiveRatePct: Math.round(presumptive.rate * 100),
                    minimumPresumptiveProfit: presumptive.minimumPresumptiveProfit,
                    withinTurnoverLimit: presumptive.withinTurnoverLimit,
                    meetsMinimumProfit: presumptive.meetsMinimumProfit,
                  }
                : {}),
            };
          })()
        : undefined,
    scheduleVIA_ChapterVIADeductions:
      result.regime === "old"
        ? {
            section80C: Math.min(profile.deductions.section80C, 150000),
            section80CCD1B: Math.min(profile.deductions.section80CCD1B, 50000),
            section80D_self: profile.deductions.section80D_self,
            section80D_parents: profile.deductions.section80D_parents,
            section80G: profile.deductions.section80G,
            section80E: profile.deductions.section80E,
            other: profile.deductions.otherDeductions,
            total: result.totalDeductionsClaimed,
          }
        : { note: "Chapter VI-A deductions (other than 80CCD(2)) are not available under the new regime." },
    partB_TI_ComputationOfTotalIncome: {
      grossTotalIncome: result.grossTotalIncome,
      totalDeductionsClaimed: result.totalDeductionsClaimed,
      totalIncome: result.taxableIncome,
    },
    partB_TTI_ComputationOfTaxLiability: {
      taxOnSlabIncome: result.taxOnSlabIncome,
      taxOnSpecialRateIncome: result.taxOnSpecialRateIncome,
      rebateUs87A: result.rebate87A,
      surcharge: result.surcharge,
      healthAndEducationCess: result.cess,
      totalTaxLiability: result.totalTaxLiability,
      taxesAlreadyPaid_TDSAndAdvanceTax: result.taxesPaid,
      balancePayableOrRefund: result.balancePayableOrRefund,
    },
  };
}

export function buildFilingWorksheet(profile: TaxProfile, comparison: ComparisonResult) {
  const applicability = determineApplicableForm(profile, comparison);
  return {
    disclaimer:
      "This worksheet organizes your figures under the same schedule names used on the e-filing portal " +
      "and in the ITR forms, so you can transcribe them quickly and correctly. It is not itself a portal " +
      "upload file. Verify every figure before filing, and consult a chartered accountant if your situation " +
      "is complex (multiple house properties, foreign income/assets, audit cases, etc.).",
    assessmentYear: `${Number(profile.financialYear.split("-")[0]) + 1}-${String(
      Number(profile.financialYear.split("-")[1]) + 1
    ).padStart(2, "0")}`,
    financialYear: profile.financialYear,
    applicableForm: applicability.form,
    formSelectionReasons: applicability.reasons,
    partA_GeneralInformation: {
      name: profile.personalInfo.fullName || "(not provided)",
      pan: profile.personalInfo.pan || "(not provided)",
      dateOfBirth: profile.personalInfo.dateOfBirth || "(not provided)",
      residentialStatus: profile.personalInfo.residentialStatus,
    },
    regimeOptedRecommendation: comparison.recommended,
    oldRegimeWorksheet: regimeWorksheet(comparison.old, profile),
    newRegimeWorksheet: regimeWorksheet(comparison.new, profile),
  };
}

/**
 * Best-effort, ITR-1-shaped draft JSON for the common resident-salaried case. See the module-level
 * comment: treat this as a reference draft, not a guaranteed-valid portal upload file.
 */
export function buildDraftItr1(profile: TaxProfile, comparison: ComparisonResult) {
  const applicability = determineApplicableForm(profile, comparison);
  if (applicability.form !== "ITR-1") {
    return null;
  }
  const result = comparison[comparison.recommended];
  const salaryHead = computeSalaryHead(profile.salary, result.regime);
  const assessmentYear = `${Number(profile.financialYear.split("-")[0]) + 1}`;

  return {
    _disclaimer:
      "DRAFT / REFERENCE ONLY. This file approximates the structure of the Income Tax Department's ITR-1 " +
      "offline-utility JSON from public knowledge of past schemas, but the department's exact schema and " +
      "internal validation (including checksum/digest fields) can change every assessment year and are not " +
      "reproduced here. Do not upload this file directly to the e-filing portal without first validating it " +
      "against the current year's offline utility — import your numbers into the official utility (or the " +
      "online portal) and use this file only as a cross-check of the figures.",
    ITR: {
      ITR1: {
        Form_ITR1: {
          FormName: "ITR-1",
          Description: "For individuals being a resident (other than not ordinarily resident) having total income up to Rs.50 lakh",
          AssessmentYear: assessmentYear,
        },
        PartA_GEN1: {
          PersonalInfo: {
            AssesseeName: profile.personalInfo.fullName || undefined,
            PAN: profile.personalInfo.pan || undefined,
            DOB: profile.personalInfo.dateOfBirth || undefined,
          },
          FilingStatus: {
            ResidentialStatus: profile.personalInfo.residentialStatus,
            OptingRegime: comparison.recommended === "new" ? "New Regime u/s 115BAC" : "Old Regime",
          },
        },
        ITR1_IncomeDeductions: {
          GrossSalary: salaryHead.grossSalary,
          AllowancesExemptUs10: salaryHead.hraExemption,
          Section80CCD2: salaryHead.section80CCD2,
          StandardDeduction: salaryHead.standardDeduction,
          IncomeFromSal: salaryHead.taxableSalary,
          TypeOfHP: profile.houseProperty.isSelfOccupied ? "Self-Occupied" : "Let-Out",
          IncomeOthSrc:
            profile.otherSources.savingsInterest +
            profile.otherSources.fdInterest +
            profile.otherSources.dividendIncome +
            profile.otherSources.otherIncome,
          GrossTotIncome: result.grossTotalIncome,
          UsrDeductUndChapVIA: result.regime === "old" ? result.totalDeductionsClaimed : 0,
          TotalIncome: result.taxableIncome,
        },
        TaxComputation: {
          TaxOnTotalIncome: result.taxOnSlabIncome,
          Rebate87A: result.rebate87A,
          Surcharge: result.surcharge,
          HealthEduCess: result.cess,
          GrossTaxLiability: result.totalTaxLiability,
        },
        TaxPaid: {
          TDS: profile.tdsAlreadyPaid,
          AdvanceTax: profile.advanceTaxPaid,
          TotalTaxesPaid: result.taxesPaid,
        },
        Refund: {
          RefundDue: result.balancePayableOrRefund < 0 ? Math.abs(result.balancePayableOrRefund) : 0,
        },
        BalanceTaxPayable: {
          BalTaxPayable: result.balancePayableOrRefund > 0 ? result.balancePayableOrRefund : 0,
        },
      },
    },
  };
}

/**
 * Best-effort, ITR-4 (Sugam)-shaped draft JSON for presumptive business/professional income
 * (Section 44AD/44ADA) combined with salary/house-property/other-sources income. Same caveats as
 * `buildDraftItr1` — a reference draft, not a guaranteed-valid portal upload file.
 */
export function buildDraftItr4(profile: TaxProfile, comparison: ComparisonResult) {
  const applicability = determineApplicableForm(profile, comparison);
  if (applicability.form !== "ITR-4") {
    return null;
  }
  const result = comparison[comparison.recommended];
  const salaryHead = computeSalaryHead(profile.salary, result.regime);
  const presumptive = computePresumptiveDetails(profile.business);
  const assessmentYear = `${Number(profile.financialYear.split("-")[0]) + 1}`;

  return {
    _disclaimer:
      "DRAFT / REFERENCE ONLY. This file approximates the structure of the Income Tax Department's ITR-4 " +
      "(Sugam) offline-utility JSON from public knowledge of past schemas, but the department's exact schema " +
      "and internal validation (including checksum/digest fields) can change every assessment year and are " +
      "not reproduced here. Do not upload this file directly to the e-filing portal without first validating " +
      "it against the current year's offline utility — import your numbers into the official utility (or the " +
      "online portal) and use this file only as a cross-check of the figures.",
    ITR: {
      ITR4: {
        Form_ITR4: {
          FormName: "ITR-4 (Sugam)",
          Description:
            "For resident individuals/HUF/firms (other than LLP) with presumptive business/professional income under Section 44AD/44ADA/44AE, total income up to Rs.50 lakh",
          AssessmentYear: assessmentYear,
        },
        PartA_GEN: {
          PersonalInfo: {
            AssesseeName: profile.personalInfo.fullName || undefined,
            PAN: profile.personalInfo.pan || undefined,
            DOB: profile.personalInfo.dateOfBirth || undefined,
          },
          FilingStatus: {
            ResidentialStatus: profile.personalInfo.residentialStatus,
            OptingRegime: comparison.recommended === "new" ? "New Regime u/s 115BAC" : "Old Regime",
          },
        },
        ScheduleBP_PresumptiveIncome: {
          Section: presumptive?.scheme,
          GrossTurnoverOrReceipts: profile.business.turnoverOrGrossReceipts,
          PresumptiveRatePct: presumptive ? Math.round(presumptive.rate * 100) : undefined,
          MinimumPresumptiveProfit: presumptive?.minimumPresumptiveProfit,
          DeclaredProfit: profile.business.netProfit,
        },
        IncomeDeductions: {
          GrossSalary: salaryHead.grossSalary,
          AllowancesExemptUs10: salaryHead.hraExemption,
          Section80CCD2: salaryHead.section80CCD2,
          StandardDeduction: salaryHead.standardDeduction,
          IncomeFromSal: salaryHead.taxableSalary,
          TypeOfHP: profile.houseProperty.isSelfOccupied ? "Self-Occupied" : "Let-Out",
          PresumptiveBusinessIncome: profile.business.netProfit,
          IncomeOthSrc:
            profile.otherSources.savingsInterest +
            profile.otherSources.fdInterest +
            profile.otherSources.dividendIncome +
            profile.otherSources.otherIncome,
          GrossTotIncome: result.grossTotalIncome,
          UsrDeductUndChapVIA: result.regime === "old" ? result.totalDeductionsClaimed : 0,
          TotalIncome: result.taxableIncome,
        },
        TaxComputation: {
          TaxOnTotalIncome: result.taxOnSlabIncome,
          Rebate87A: result.rebate87A,
          Surcharge: result.surcharge,
          HealthEduCess: result.cess,
          GrossTaxLiability: result.totalTaxLiability,
        },
        TaxPaid: {
          TDS: profile.tdsAlreadyPaid,
          AdvanceTax: profile.advanceTaxPaid,
          TotalTaxesPaid: result.taxesPaid,
        },
        Refund: {
          RefundDue: result.balancePayableOrRefund < 0 ? Math.abs(result.balancePayableOrRefund) : 0,
        },
        BalanceTaxPayable: {
          BalTaxPayable: result.balancePayableOrRefund > 0 ? result.balancePayableOrRefund : 0,
        },
      },
    },
  };
}
