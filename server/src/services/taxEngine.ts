import type {
  AgeBand,
  ComparisonResult,
  Deductions,
  RegimeResult,
  SalaryIncome,
  TaxProfile,
} from "../types.js";

/**
 * Simplified Indian individual income-tax engine for FY 2024-25 (AY 2025-26).
 *
 * Known simplifications (documented for transparency, not hidden from users):
 * - Marginal relief on surcharge is not computed.
 * - Indexation benefit for LTCG on assets acquired before 23-Jul-2024 is not modeled;
 *   a flat 12.5% is applied to "other" LTCG.
 * - House-property loss set-off against other heads is capped at 2,00,000 per
 *   Sec 71(3A); any excess is dropped rather than carried forward.
 * - Presumptive taxation schemes (44AD/44ADA) are not modeled for business income.
 * This tool is a planning aid, not a substitute for a qualified tax professional
 * or the official e-filing utility.
 */

const round = (n: number) => Math.round(n * 100) / 100;
const clampMin0 = (n: number) => Math.max(0, n);

export function calcHRAExemption(salary: SalaryIncome): number {
  if (salary.rentPaid <= 0 || salary.hraReceived <= 0) return 0;
  const basic = salary.basicPlusDA;
  const excessRent = clampMin0(salary.rentPaid - 0.1 * basic);
  const percentOfBasic = (salary.isMetro ? 0.5 : 0.4) * basic;
  return round(Math.min(salary.hraReceived, excessRent, percentOfBasic));
}

interface SlabBracket {
  upto: number; // exclusive upper bound, Infinity for the top bracket
  rate: number;
}

function getOldRegimeSlabs(ageBand: AgeBand): SlabBracket[] {
  if (ageBand === "above80") {
    return [
      { upto: 500000, rate: 0 },
      { upto: 1000000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ];
  }
  if (ageBand === "60to80") {
    return [
      { upto: 300000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ];
  }
  return [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ];
}

function getNewRegimeSlabs(): SlabBracket[] {
  return [
    { upto: 300000, rate: 0 },
    { upto: 700000, rate: 0.05 },
    { upto: 1000000, rate: 0.1 },
    { upto: 1200000, rate: 0.15 },
    { upto: 1500000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ];
}

function computeSlabTax(taxableIncome: number, brackets: SlabBracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= lower) break;
    const upper = Math.min(taxableIncome, bracket.upto);
    tax += Math.max(0, upper - lower) * bracket.rate;
    lower = bracket.upto;
  }
  return tax;
}

function computeSurcharge(taxAfterRebate: number, totalIncome: number, regime: "old" | "new"): number {
  let rate = 0;
  if (totalIncome > 50000000) rate = regime === "new" ? 0.25 : 0.37;
  else if (totalIncome > 20000000) rate = 0.25;
  else if (totalIncome > 10000000) rate = 0.15;
  else if (totalIncome > 5000000) rate = 0.1;
  return round(taxAfterRebate * rate);
}

function chapterVIATotal(d: Deductions, ageBand: AgeBand): number {
  const selfCap = ageBand === "below60" ? 25000 : 50000;
  const parentsCap = d.parentsAreSenior ? 50000 : 25000;
  const d80C = Math.min(d.section80C, 150000);
  const d80CCD1B = Math.min(d.section80CCD1B, 50000);
  const d80DSelf = Math.min(d.section80D_self, selfCap);
  const d80DParents = Math.min(d.section80D_parents, parentsCap);
  return (
    d80C +
    d80CCD1B +
    d80DSelf +
    d80DParents +
    Math.max(0, d.section80G) +
    Math.max(0, d.section80E) +
    Math.max(0, d.otherDeductions)
  );
}

export interface SalaryHeadResult {
  grossSalary: number;
  hraExemption: number;
  section80CCD2: number;
  standardDeduction: number;
  /** "Income chargeable under the head Salaries" — after HRA exemption, 80CCD(2) and standard deduction. */
  taxableSalary: number;
}

export function computeSalaryHead(salary: SalaryIncome, regime: "old" | "new"): SalaryHeadResult {
  const grossSalary =
    salary.basicPlusDA + salary.otherAllowances + salary.hraReceived + salary.employerNpsContribution;
  const hraExemption = regime === "old" ? calcHRAExemption(salary) : 0;
  const npsCap = (regime === "new" ? 0.14 : 0.1) * salary.basicPlusDA;
  const section80CCD2 = Math.min(salary.employerNpsContribution, npsCap);
  const standardDeduction = grossSalary > 0 ? (regime === "new" ? 75000 : 50000) : 0;
  const taxableSalary = clampMin0(grossSalary - hraExemption - section80CCD2 - standardDeduction);
  return { grossSalary, hraExemption, section80CCD2, standardDeduction, taxableSalary };
}

export function computeRegime(profile: TaxProfile, regime: "old" | "new"): RegimeResult {
  const { salary, houseProperty, capitalGains, otherSources, business, deductions, ageBand } = profile;

  // --- Salary ---
  const { grossSalary, hraExemption, section80CCD2, standardDeduction, taxableSalary } = computeSalaryHead(
    salary,
    regime
  );

  // --- House property ---
  let housePropertyIncome: number;
  if (houseProperty.isSelfOccupied) {
    const interestAllowed = regime === "old" ? Math.min(houseProperty.homeLoanInterest, 200000) : 0;
    housePropertyIncome = -interestAllowed;
  } else {
    const nav = clampMin0(houseProperty.annualRentReceived - houseProperty.municipalTaxesPaid);
    const stdDed30 = nav * 0.3;
    housePropertyIncome = nav - stdDed30 - houseProperty.homeLoanInterest;
  }
  const housePropertyForSlab = Math.max(housePropertyIncome, -200000);

  // --- Other sources ---
  const otherSourcesTotal =
    otherSources.savingsInterest + otherSources.fdInterest + otherSources.dividendIncome + otherSources.otherIncome;
  const ttaTtbCap = ageBand === "below60" ? 10000 : 50000;
  const eligibleInterest =
    ageBand === "below60" ? otherSources.savingsInterest : otherSources.savingsInterest + otherSources.fdInterest;
  const ttaTtbDeduction = regime === "old" ? Math.min(eligibleInterest, ttaTtbCap) : 0;
  const otherSourcesTaxable = otherSourcesTotal - ttaTtbDeduction;

  // --- Business ---
  const businessIncome = business.netProfit;

  // --- Chapter VI-A (old regime only) ---
  const totalDeductionsClaimed = regime === "old" ? chapterVIATotal(deductions, ageBand) : 0;

  // --- Capital gains (special rates) ---
  const ltcgEquityTaxable = clampMin0(capitalGains.ltcgEquity - 125000);
  const taxOnSpecialRateIncome = round(
    capitalGains.stcgEquity * 0.2 + ltcgEquityTaxable * 0.125 + capitalGains.ltcgOther * 0.125
  );

  // --- Slab income ---
  const slabIncomeRaw =
    taxableSalary +
    housePropertyForSlab +
    otherSourcesTaxable +
    businessIncome +
    capitalGains.stcgOther -
    totalDeductionsClaimed;
  const taxableIncomeSlabPortion = clampMin0(round(slabIncomeRaw));

  const brackets = regime === "old" ? getOldRegimeSlabs(ageBand) : getNewRegimeSlabs();
  const taxOnSlabIncome = round(computeSlabTax(taxableIncomeSlabPortion, brackets));

  const totalTaxBeforeRebate = round(taxOnSlabIncome + taxOnSpecialRateIncome);

  // --- Rebate 87A ---
  const totalIncomeForRebate =
    taxableIncomeSlabPortion + capitalGains.stcgEquity + ltcgEquityTaxable + capitalGains.ltcgOther;
  const rebateThreshold = regime === "old" ? 500000 : 700000;
  const rebateCap = regime === "old" ? 12500 : 25000;
  const rebate87A = totalIncomeForRebate <= rebateThreshold ? Math.min(totalTaxBeforeRebate, rebateCap) : 0;
  const taxAfterRebate = round(totalTaxBeforeRebate - rebate87A);

  // --- Surcharge & cess ---
  const surcharge = computeSurcharge(taxAfterRebate, totalIncomeForRebate, regime);
  const cess = round((taxAfterRebate + surcharge) * 0.04);
  const totalTaxLiability = round(taxAfterRebate + surcharge + cess);

  const taxesPaid = profile.tdsAlreadyPaid + profile.advanceTaxPaid;
  const balancePayableOrRefund = round(totalTaxLiability - taxesPaid);

  const grossTotalIncome = round(
    grossSalary -
      hraExemption -
      section80CCD2 +
      housePropertyIncome +
      otherSourcesTotal +
      businessIncome +
      capitalGains.stcgOther +
      capitalGains.stcgEquity +
      capitalGains.ltcgEquity +
      capitalGains.ltcgOther
  );

  return {
    regime,
    grossTotalIncome,
    standardDeduction,
    totalDeductionsClaimed,
    hraExemption,
    taxableIncome: round(taxableIncomeSlabPortion + capitalGains.stcgEquity + capitalGains.ltcgEquity + capitalGains.ltcgOther),
    taxableIncomeSlabPortion,
    taxOnSlabIncome,
    taxOnSpecialRateIncome,
    totalTaxBeforeRebate,
    rebate87A,
    taxAfterRebate,
    surcharge,
    cess,
    totalTaxLiability,
    taxesPaid,
    balancePayableOrRefund,
  };
}

export function compareRegimes(profile: TaxProfile): ComparisonResult {
  const oldResult = computeRegime(profile, "old");
  const newResult = computeRegime(profile, "new");
  const recommended = newResult.totalTaxLiability <= oldResult.totalTaxLiability ? "new" : "old";
  const savingsAmount = round(Math.abs(oldResult.totalTaxLiability - newResult.totalTaxLiability));
  return { old: oldResult, new: newResult, recommended, savingsAmount };
}
