import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { NumberField, Section, ToggleField } from "../components/FormControls";
import { useTaxReturn } from "../context/TaxReturnContext";

export function Deductions() {
  const { profile, updateProfile, save, saving, financialYear } = useTaxReturn();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestError(null);
    try {
      await save();
      const res = await api.suggestDeductions(financialYear);
      setSuggestions(res.suggestions);
    } catch (err) {
      setSuggestError(err instanceof ApiError ? err.message : "Could not fetch AI suggestions right now.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Deductions</h1>
      <p className="text-slate-500 text-sm mb-6">
        Most of these deductions only apply under the <strong>old tax regime</strong>. They're still collected here so
        we can compare both regimes accurately.
      </p>

      <Section title="Section 80C" description="PPF, ELSS, EPF, life insurance premium, tuition fees, home loan principal, etc.">
        <NumberField
          label="80C investments (max ₹1,50,000)"
          value={profile.deductions.section80C}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80C: v } }))}
        />
        <NumberField
          label="80CCD(1B) additional NPS (max ₹50,000)"
          value={profile.deductions.section80CCD1B}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80CCD1B: v } }))}
        />
      </Section>

      <Section title="Section 80D" description="Health insurance premiums.">
        <NumberField
          label="Self & family premium"
          value={profile.deductions.section80D_self}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80D_self: v } }))}
          hint="Max ₹25,000 (₹50,000 if you are a senior citizen)"
        />
        <NumberField
          label="Parents' premium"
          value={profile.deductions.section80D_parents}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80D_parents: v } }))}
          hint="Max ₹25,000 (₹50,000 if parents are senior citizens)"
        />
        <ToggleField
          label="My parents are senior citizens (60+)"
          checked={profile.deductions.parentsAreSenior}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, parentsAreSenior: v } }))}
        />
      </Section>

      <Section title="Other deductions">
        <NumberField
          label="80G — Donations (eligible amount)"
          value={profile.deductions.section80G}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80G: v } }))}
        />
        <NumberField
          label="80E — Education loan interest"
          value={profile.deductions.section80E}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, section80E: v } }))}
        />
        <NumberField
          label="Other Chapter VI-A deductions"
          value={profile.deductions.otherDeductions}
          onChange={(v) => updateProfile((p) => ({ ...p, deductions: { ...p.deductions, otherDeductions: v } }))}
        />
      </Section>

      <div className="bg-brand-50 dark:bg-slate-800 border border-brand-100 dark:border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">AI deduction check</h2>
          <button
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            {loadingSuggestions ? "Analyzing…" : "Check for missed deductions"}
          </button>
        </div>
        {suggestError && <p className="text-sm text-red-600">{suggestError}</p>}
        {suggestions && <div className="text-sm whitespace-pre-wrap">{suggestions}</div>}
        {!suggestions && !suggestError && (
          <p className="text-sm text-slate-500">
            Save your income and deductions, then ask the AI assistant to review your entries for commonly missed
            tax-saving opportunities.
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => navigate("/income")}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={async () => {
            await save();
            navigate("/summary");
          }}
          disabled={saving}
          className="rounded-md bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "See summary"}
        </button>
      </div>
    </div>
  );
}
