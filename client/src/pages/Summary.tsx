import { useEffect } from "react";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { RegimeResult } from "../types";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function RegimeCard({ result, isRecommended }: { result: RegimeResult; isRecommended: boolean }) {
  return (
    <div
      className={`rounded-xl border p-6 flex-1 ${
        isRecommended
          ? "border-brand-500 bg-brand-50 dark:bg-slate-800 ring-2 ring-brand-500"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize">{result.regime} regime</h3>
        {isRecommended && (
          <span className="text-xs font-semibold bg-brand-600 text-white rounded-full px-2 py-1">Recommended</span>
        )}
      </div>
      <dl className="text-sm space-y-2">
        <Row label="Gross total income" value={formatINR(result.grossTotalIncome)} />
        <Row label="Standard deduction" value={formatINR(result.standardDeduction)} />
        {result.hraExemption > 0 && <Row label="HRA exemption" value={formatINR(result.hraExemption)} />}
        <Row label="Chapter VI-A deductions" value={formatINR(result.totalDeductionsClaimed)} />
        <Row label="Taxable income" value={formatINR(result.taxableIncome)} bold />
        <Row label="Tax on slab income" value={formatINR(result.taxOnSlabIncome)} />
        <Row label="Tax on capital gains" value={formatINR(result.taxOnSpecialRateIncome)} />
        <Row label="Rebate (Sec 87A)" value={`- ${formatINR(result.rebate87A)}`} />
        <Row label="Surcharge" value={formatINR(result.surcharge)} />
        <Row label="Health & education cess" value={formatINR(result.cess)} />
        <Row label="Total tax liability" value={formatINR(result.totalTaxLiability)} bold />
        <Row label="Taxes already paid" value={formatINR(result.taxesPaid)} />
        <Row
          label={result.balancePayableOrRefund >= 0 ? "Balance payable" : "Refund due"}
          value={formatINR(Math.abs(result.balancePayableOrRefund))}
          bold
          highlight={result.balancePayableOrRefund < 0 ? "green" : result.balancePayableOrRefund > 0 ? "red" : undefined}
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: "green" | "red";
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold border-t border-slate-200 dark:border-slate-700 pt-2 mt-2" : ""}`}>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={
          highlight === "green" ? "text-green-600" : highlight === "red" ? "text-red-600" : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function Summary() {
  const { comparison, recompute, profile } = useTaxReturn();

  useEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Regime Comparison</h1>
      <p className="text-slate-500 text-sm mb-6">
        Based on the income and deductions you've entered for FY {profile.financialYear}.
      </p>

      {!comparison && <p className="text-slate-500">Calculating…</p>}

      {comparison && (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <RegimeCard result={comparison.old} isRecommended={comparison.recommended === "old"} />
            <RegimeCard result={comparison.new} isRecommended={comparison.recommended === "new"} />
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-sm text-slate-600 dark:text-slate-300">
            The <strong className="capitalize">{comparison.recommended}</strong> regime saves you{" "}
            <strong>{formatINR(comparison.savingsAmount)}</strong> compared to the other option, based on the figures
            entered. Use the AI assistant to ask why, or to explore "what-if" scenarios (e.g. increasing 80C
            investments).
          </div>
        </>
      )}

      <div className="mt-8 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-4">
        This computation is a simplified planning estimate for FY 2024-25 (AY 2025-26). It does not account for
        marginal relief on surcharge, indexation on pre-July 2024 capital assets, or presumptive taxation schemes.
        Always verify with the official Income Tax Department utility or a qualified chartered accountant before
        filing.
      </div>
    </div>
  );
}
