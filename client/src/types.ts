export type AgeBand = "below60" | "60to80" | "above80";

export interface SalaryIncome {
  basicPlusDA: number;
  hraReceived: number;
  rentPaid: number;
  isMetro: boolean;
  otherAllowances: number;
  employerNpsContribution: number;
}

export interface HouseProperty {
  isSelfOccupied: boolean;
  annualRentReceived: number;
  municipalTaxesPaid: number;
  homeLoanInterest: number;
}

export interface CapitalGains {
  stcgEquity: number;
  ltcgEquity: number;
  stcgOther: number;
  ltcgOther: number;
}

export interface OtherSources {
  savingsInterest: number;
  fdInterest: number;
  dividendIncome: number;
  otherIncome: number;
}

export interface BusinessIncome {
  netProfit: number;
}

export interface Deductions {
  section80C: number;
  section80CCD1B: number;
  section80D_self: number;
  section80D_parents: number;
  parentsAreSenior: boolean;
  section80TTA_TTB: number;
  section80G: number;
  section80E: number;
  otherDeductions: number;
}

export interface TaxProfile {
  financialYear: string;
  ageBand: AgeBand;
  salary: SalaryIncome;
  houseProperty: HouseProperty;
  capitalGains: CapitalGains;
  otherSources: OtherSources;
  business: BusinessIncome;
  deductions: Deductions;
  tdsAlreadyPaid: number;
  advanceTaxPaid: number;
}

export interface RegimeResult {
  regime: "old" | "new";
  grossTotalIncome: number;
  standardDeduction: number;
  totalDeductionsClaimed: number;
  hraExemption: number;
  taxableIncome: number;
  taxableIncomeSlabPortion: number;
  taxOnSlabIncome: number;
  taxOnSpecialRateIncome: number;
  totalTaxBeforeRebate: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTaxLiability: number;
  taxesPaid: number;
  balancePayableOrRefund: number;
}

export interface ComparisonResult {
  old: RegimeResult;
  new: RegimeResult;
  recommended: "old" | "new";
  savingsAmount: number;
}

export function blankTaxProfile(financialYear: string): TaxProfile {
  return {
    financialYear,
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
  };
}
