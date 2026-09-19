/**
 * Best-effort Form 16 (Part B salary certificate) analyzer.
 *
 * Form 16's Part B breaks down gross salary, exemptions under Section 10, the Section 16
 * deductions (standard deduction, professional tax), Chapter VI-A deductions as reported by the
 * employer, and total TDS deducted. Since it's issued directly by the employer (not something a
 * third party can fetch), the user pastes text copied from the PDF or its JSON equivalent, and
 * everything is parsed in the browser — nothing is uploaded.
 *
 * Only fields that map unambiguously onto this app's model are offered as import targets. Gross
 * salary is included as a convenience default (mapped to Basic + DA), but Form 16 doesn't usually
 * separate HRA/other allowances the way this app does for its own HRA exemption calculation — if
 * you import it, double-check the Salary section afterwards so HRA isn't double counted.
 */

import { parseDocument, type DetectedLine, type FieldRule } from "./documentParser";

export type Form16TargetField =
  | "salary.basicPlusDA"
  | "salary.professionalTax"
  | "deductions.section80C"
  | "deductions.section80CCD1B"
  | "deductions.section80D_self"
  | "tdsAlreadyPaid"
  | "ignore";

export const FORM16_TARGET_FIELD_LABELS: Record<Form16TargetField, string> = {
  "salary.basicPlusDA": "Salary (basic + DA)",
  "salary.professionalTax": "Professional tax (Sec 16(iii))",
  "deductions.section80C": "Section 80C",
  "deductions.section80CCD1B": "Section 80CCD(1B) — additional NPS",
  "deductions.section80D_self": "Section 80D — health insurance",
  tdsAlreadyPaid: "TDS already deducted",
  ignore: "Don't import this line",
};

// Order matters — more specific patterns first.
const RULES: FieldRule<Form16TargetField>[] = [
  { test: /total.*(tax deducted|tds)|tds.*total|amount of tax deducted/i, field: "tdsAlreadyPaid" },
  { test: /professional tax|tax on employment/i, field: "salary.professionalTax" },
  { test: /80ccd\s*\(?1b\)?|additional nps/i, field: "deductions.section80CCD1B" },
  { test: /80d\b|health insurance|medical insurance premium/i, field: "deductions.section80D_self" },
  { test: /\b80c\b|section 80c/i, field: "deductions.section80C" },
  {
    test: /gross salary|salary as per section 17\(1\)|salary under section 17/i,
    field: "salary.basicPlusDA",
  },
];

export function parseForm16Input(raw: string): DetectedLine<Form16TargetField>[] {
  return parseDocument(raw, RULES, "ignore", "f16");
}
