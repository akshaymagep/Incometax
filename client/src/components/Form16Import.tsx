import { useMemo, useState } from "react";
import { useTaxReturn } from "../context/TaxReturnContext";
import type { TaxProfile } from "../types";
import { FORM16_TARGET_FIELD_LABELS, parseForm16Input, type Form16TargetField } from "../utils/form16Parser";
import type { DetectedLine } from "../utils/documentParser";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function applyFieldDelta(profile: TaxProfile, field: Form16TargetField, delta: number, replace: boolean): TaxProfile {
  const combine = (current: number) => (replace ? delta : current + delta);
  switch (field) {
    case "salary.basicPlusDA":
      return { ...profile, salary: { ...profile.salary, basicPlusDA: combine(profile.salary.basicPlusDA) } };
    case "salary.professionalTax":
      return { ...profile, salary: { ...profile.salary, professionalTax: combine(profile.salary.professionalTax) } };
    case "deductions.section80C":
      return { ...profile, deductions: { ...profile.deductions, section80C: combine(profile.deductions.section80C) } };
    case "deductions.section80CCD1B":
      return {
        ...profile,
        deductions: { ...profile.deductions, section80CCD1B: combine(profile.deductions.section80CCD1B) },
      };
    case "deductions.section80D_self":
      return {
        ...profile,
        deductions: { ...profile.deductions, section80D_self: combine(profile.deductions.section80D_self) },
      };
    case "tdsAlreadyPaid":
      return { ...profile, tdsAlreadyPaid: combine(profile.tdsAlreadyPaid) };
    case "ignore":
    default:
      return profile;
  }
}

export function Form16Import() {
  const { updateProfile } = useTaxReturn();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [lines, setLines] = useState<DetectedLine<Form16TargetField>[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [replace, setReplace] = useState(false);
  const [applied, setApplied] = useState(false);

  const analyze = () => {
    const detected = parseForm16Input(raw);
    setLines(detected);
    setApplied(false);
    const initialChecked: Record<string, boolean> = {};
    for (const line of detected) initialChecked[line.id] = line.suggestedField !== "ignore";
    setChecked(initialChecked);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const setLineField = (id: string, field: Form16TargetField) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, suggestedField: field } : l)));
  };

  const totalsByField = useMemo(() => {
    const totals = new Map<Form16TargetField, number>();
    for (const line of lines) {
      if (!checked[line.id] || line.suggestedField === "ignore") continue;
      totals.set(line.suggestedField, (totals.get(line.suggestedField) ?? 0) + line.amount);
    }
    return totals;
  }, [lines, checked]);

  const apply = () => {
    updateProfile((profile) => {
      let next = profile;
      for (const [field, amount] of totalsByField.entries()) {
        next = applyFieldDelta(next, field, amount, replace);
      }
      return next;
    });
    setApplied(true);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6">
      <button className="flex items-center justify-between w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <h2 className="text-lg font-semibold">Import from your Form 16</h2>
          <p className="text-sm text-slate-500 mt-1">
            Paste your Form 16 Part B to review your salary structure and pull in TDS/deduction figures.
          </p>
        </div>
        <span className="text-slate-400 text-xl">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-md p-3">
            Form 16 is issued directly by your employer (usually from the payroll portal, not password
            protected). Paste the text from Part B below, or upload it as a .txt/.json file. This runs entirely
            in your browser. Note: Form 16 usually reports one combined gross salary figure rather than the
            separate Basic+DA / HRA / other-allowances split this app uses for its own HRA exemption
            calculation — if you import "Gross Salary", check the Salary section afterwards so you don't lose
            or double-count your HRA exemption.
          </div>

          <input
            type="file"
            accept=".json,.txt"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm"
          />
          <textarea
            className="w-full h-32 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono"
            placeholder="Paste Form 16 Part B text or JSON here…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button
            onClick={analyze}
            disabled={!raw.trim()}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            Analyze
          </button>

          {lines.length === 0 && raw.trim() && (
            <p className="text-sm text-amber-600">
              No amount/description pairs were detected. Try pasting the raw text rows from Form 16 Part B (each
              line should end with a number).
            </p>
          )}

          {lines.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-2"></th>
                      <th className="py-2 pr-2">Description (from Form 16)</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2 pr-2">Add to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={Boolean(checked[line.id])}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [line.id]: e.target.checked }))}
                          />
                        </td>
                        <td className="py-2 pr-2 max-w-xs truncate" title={line.description}>
                          {line.description}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">{formatINR(line.amount)}</td>
                        <td className="py-2 pr-2">
                          <select
                            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                            value={line.suggestedField}
                            onChange={(e) => setLineField(line.id, e.target.value as Form16TargetField)}
                          >
                            {Object.entries(FORM16_TARGET_FIELD_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalsByField.size > 0 && (
                <div className="text-sm bg-brand-50 dark:bg-slate-900 rounded-md p-3">
                  <p className="font-medium mb-1">This will update:</p>
                  <ul className="list-disc ml-5 text-slate-600 dark:text-slate-300">
                    {Array.from(totalsByField.entries()).map(([field, amount]) => (
                      <li key={field}>
                        {FORM16_TARGET_FIELD_LABELS[field]}: {replace ? "set to" : "+"} {formatINR(amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Replace existing values instead of adding to them
              </label>

              <button
                onClick={apply}
                disabled={totalsByField.size === 0}
                className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                Apply to income details
              </button>
              {applied && <span className="ml-3 text-sm text-green-600">Applied — review the fields below.</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
