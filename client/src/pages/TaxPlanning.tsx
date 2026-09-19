import { useState } from "react";
import { api, ApiError } from "../api/client";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { ComparisonResult } from "../types";
import { buildMaxedDeductionsProfile, buildProjectedProfile, computeDeductionHeadroom } from "../utils/taxPlanning";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function HeadroomSection() {
  const { profile, comparison } = useTaxReturn();
  if (!comparison) return null;

  if (comparison.recommended === "new") {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Deduction headroom</h2>
        <p className="text-sm text-slate-500">
          The new regime is currently recommended for you, and it doesn't allow most Chapter VI-A deductions (80C,
          80D, etc.) — so there's little to plan for there beyond your employer's NPS contribution (Section
          80CCD(2)). Use the check below to see whether maxing out old-regime deductions would flip the
          recommendation.
        </p>
      </div>
    );
  }

  const items = computeDeductionHeadroom(profile, comparison);
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Deduction headroom (old regime)</h2>
      <p className="text-sm text-slate-500 mb-4">
        Based on what you've already claimed, here's how much more you could invest this year and roughly what it
        would save at your marginal tax rate. Approximate — doesn't account for crossing a tax bracket.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-green-600">You've maxed out the common deduction limits already.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2">Deduction</th>
              <th className="py-2">Used</th>
              <th className="py-2">Remaining room</th>
              <th className="py-2">Est. tax saved if maxed</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2">{item.label}</td>
                <td className="py-2 pr-2">{formatINR(item.used)}</td>
                <td className="py-2 pr-2">{formatINR(item.remaining)}</td>
                <td className="py-2 pr-2 font-medium text-brand-700 dark:text-brand-400">
                  {formatINR(item.estTaxSaved)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RegimeSwitchCheck() {
  const { profile, financialYear } = useTaxReturn();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const maxed = buildMaxedDeductionsProfile(profile);
      const res = await api.compute(financialYear, maxed);
      setResult(res.comparison);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run this check.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-lg font-semibold">Would maxing deductions change your regime pick?</h2>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Run check"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-3">
        Assumes you claim the full ₹1,50,000 (80C), ₹50,000 (80CCD(1B)), and max 80D limits — everything else stays
        the same.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="text-sm">
          With those deductions maxed, old regime tax would be <strong>{formatINR(result.old.totalTaxLiability)}</strong>{" "}
          vs new regime <strong>{formatINR(result.new.totalTaxLiability)}</strong> — the better option would be{" "}
          <strong className="capitalize">{result.recommended}</strong>.
        </div>
      )}
    </div>
  );
}

function WhatIfProjector() {
  const { profile, financialYear } = useTaxReturn();
  const [salaryGrowthPct, setSalaryGrowthPct] = useState(10);
  const [extra80C, setExtra80C] = useState(0);
  const [extra80CCD1B, setExtra80CCD1B] = useState(0);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const projected = buildProjectedProfile(profile, { salaryGrowthPct, extra80C, extra80CCD1B });
      const res = await api.compute(financialYear, projected);
      setResult(res.comparison);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run the projection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">What-if: plan for next year</h2>
      <p className="text-sm text-slate-500 mb-4">
        Rough projection using this year's slab rules (they may change in the next Budget) — useful for ballpark
        planning, not a forecast.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <label className="block">
          <span className="text-sm font-medium">Expected salary growth (%)</span>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            value={salaryGrowthPct}
            onChange={(e) => setSalaryGrowthPct(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Additional 80C planned (₹)</span>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            value={extra80C}
            onChange={(e) => setExtra80C(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Additional 80CCD(1B) planned (₹)</span>
          <input
            type="number"
            className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            value={extra80CCD1B}
            onChange={(e) => setExtra80CCD1B(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <button
        onClick={run}
        disabled={loading}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Projecting…" : "Project next year"}
      </button>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {result && (
        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-3">
            <div className="font-medium mb-1">Old regime</div>
            <div>Taxable income: {formatINR(result.old.taxableIncome)}</div>
            <div>Tax liability: {formatINR(result.old.totalTaxLiability)}</div>
          </div>
          <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-3">
            <div className="font-medium mb-1">New regime</div>
            <div>Taxable income: {formatINR(result.new.taxableIncome)}</div>
            <div>Tax liability: {formatINR(result.new.totalTaxLiability)}</div>
          </div>
          <div className="sm:col-span-2 text-slate-600 dark:text-slate-300">
            Recommended: <strong className="capitalize">{result.recommended}</strong> (saves{" "}
            {formatINR(result.savingsAmount)})
          </div>
        </div>
      )}
    </div>
  );
}

function AiSavingsPlan() {
  const { financialYear, save } = useTaxReturn();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      await save();
      const res = await api.savingsPlan(financialYear);
      setPlan(res.plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a plan right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-50 dark:bg-slate-800 border border-brand-100 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-lg font-semibold">AI savings plan for next year</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Generate plan"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {plan && <div className="text-sm whitespace-pre-wrap">{plan}</div>}
      {!plan && !error && (
        <p className="text-sm text-slate-500">
          Get a short, personalized plan for next financial year based on your current numbers.
        </p>
      )}
    </div>
  );
}

export function TaxPlanning() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Tax Planning</h1>
      <p className="text-slate-500 text-sm mb-6">
        Look ahead: unused deduction room this year, whether the old regime is worth switching to if you use it
        fully, and a rough projection for next year.
      </p>
      <HeadroomSection />
      <RegimeSwitchCheck />
      <WhatIfProjector />
      <AiSavingsPlan />
    </div>
  );
}
