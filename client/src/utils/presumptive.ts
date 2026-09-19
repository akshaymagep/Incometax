import type { BusinessIncome } from "../types";

/**
 * Client-side mirror of the server's Section 44AD/44ADA presumptive-taxation math, used only to
 * give the user an immediate hint while filling the form. The server (`itrExport.ts`) recomputes
 * this independently for the actual ITR-form determination — this copy is for UI feedback only.
 */
export interface PresumptiveDetails {
  scheme: "44AD" | "44ADA";
  rate: number;
  turnoverLimit: number;
  minimumPresumptiveProfit: number;
  withinTurnoverLimit: boolean;
  meetsMinimumProfit: boolean;
}

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
