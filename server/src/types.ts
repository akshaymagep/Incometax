export type AgeBand = "below60" | "60to80" | "above80";
export type ResidentialStatus = "resident" | "nonResident" | "notOrdinarilyResident";

export interface PersonalInfo {
  fullName: string;
  pan: string; // stored locally only; used to prefill the filing worksheet export
  dateOfBirth: string; // ISO yyyy-mm-dd
  residentialStatus: ResidentialStatus;
}

export interface SalaryIncome {
  basicPlusDA: number;
  hraReceived: number;
  rentPaid: number;
  isMetro: boolean;
  otherAllowances: number;
  employerNpsContribution: number; // 80CCD(2)
}

export interface HouseProperty {
  isSelfOccupied: boolean;
  annualRentReceived: number;
  municipalTaxesPaid: number;
  homeLoanInterest: number; // Section 24(b)
}

export interface CapitalGains {
  stcgEquity: number; // STCG on listed equity/equity MF (Sec 111A)
  ltcgEquity: number; // LTCG on listed equity/equity MF (Sec 112A)
  stcgOther: number; // taxed at slab rate
  ltcgOther: number; // simplified flat 12.5% (post July 2024 rules, without indexation)
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
  section80C: number; // PPF, ELSS, EPF, life insurance, etc. cap 150000
  section80CCD1B: number; // additional NPS, cap 50000
  section80D_self: number; // health insurance self/family, cap 25000/50000
  section80D_parents: number; // health insurance parents, cap 25000/50000
  parentsAreSenior: boolean;
  section80TTA_TTB: number; // savings interest deduction, cap 10000/50000
  section80G: number; // donations (user-entered eligible amount)
  section80E: number; // education loan interest, no cap
  otherDeductions: number; // catch-all for other chapter VI-A deductions
}

export interface TaxProfile {
  financialYear: string; // e.g. "2024-25"
  ageBand: AgeBand;
  personalInfo: PersonalInfo;
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
  balancePayableOrRefund: number; // positive = payable, negative = refund
}

export interface ComparisonResult {
  old: RegimeResult;
  new: RegimeResult;
  recommended: "old" | "new";
  savingsAmount: number;
}
