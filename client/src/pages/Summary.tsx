import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { FilingExport, RegimeResult } from "../types";

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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function FilingExportSection() {
  const { financialYear, save } = useTaxReturn();
  const [result, setResult] = useState<FilingExport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      await save();
      const res = await api.exportFiling(financialYear);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate the filing export.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Filing export</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate filing export"}
        </button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Produces a worksheet organized by the same schedule names the ITR forms and e-filing portal use (Schedule
        S/HP/CG/OS/VI-A, Part B-TI/TTI), so you can transcribe it quickly and correctly. This app cannot submit
        anything to the Income Tax Department directly — you still file through{" "}
        <span className="font-medium">incometax.gov.in</span> or the official offline utility.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="text-sm bg-slate-50 dark:bg-slate-900 rounded-md p-3">
            Based on what you entered, the applicable form looks like{" "}
            <strong>{result.applicability.form}</strong>.
            <ul className="list-disc ml-5 mt-1 text-slate-500">
              {result.applicability.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => downloadJson(`filing-worksheet-${financialYear}.json`, result.worksheet)}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Download filing worksheet (JSON)
            </button>
            {result.draftItr1 && (
              <button
                onClick={() => downloadJson(`draft-itr1-${financialYear}.json`, result.draftItr1)}
                className="rounded-md border border-amber-400 text-amber-700 dark:text-amber-400 px-4 py-2 text-sm font-medium hover:bg-amber-50 dark:hover:bg-slate-700"
              >
                Download draft ITR-1 JSON (experimental)
              </button>
            )}
            {result.draftItr4 && (
              <button
                onClick={() => downloadJson(`draft-itr4-${financialYear}.json`, result.draftItr4)}
                className="rounded-md border border-amber-400 text-amber-700 dark:text-amber-400 px-4 py-2 text-sm font-medium hover:bg-amber-50 dark:hover:bg-slate-700"
              >
                Download draft ITR-4 JSON (experimental)
              </button>
            )}
          </div>

          {(result.draftItr1 || result.draftItr4) && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-slate-900 rounded-md p-3">
              The draft {result.draftItr1 ? "ITR-1" : "ITR-4"} JSON approximates the offline utility's structure but
              is <strong>not guaranteed</strong> to match the current assessment year's exact schema or pass the
              utility's validation. Treat it as a cross-check of your numbers, not a ready-to-upload file — build the
              real submission using the official portal or offline utility.
            </p>
          )}

          {!result.draftItr1 && !result.draftItr4 && (
            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-md p-3">
              {result.applicability.form} is complex enough that we'd rather not guess: it has schedules (detailed
              capital-gains asset-wise entries, foreign assets, quarter-wise breakups, tax-audit particulars) that
              vary by case and that we don't collect, so an experimental JSON draft could easily be wrong in ways
              that are hard to spot. The filing worksheet above still has every figure organized by schedule name —
              use it to fill the official portal or offline utility directly.
            </p>
          )}
        </div>
      )}
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

      <div className="mt-6">
        <FilingExportSection />
      </div>

      <div className="mt-8 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-4">
        This computation is a simplified planning estimate for FY 2024-25 (AY 2025-26). It does not account for
        marginal relief on surcharge or indexation on capital assets acquired before 23-Jul-2024. Presumptive
        taxation (Section 44AD/44ADA) is supported for ITR-form selection and the minimum-profit calculator, but
        the underlying computation still treats declared net profit as a single figure — it doesn't model 44AE
        (transport) or partial-year presumptive scenarios. Always verify with the official Income Tax Department
        utility or a qualified chartered accountant before filing.
      </div>
    </div>
  );
}
