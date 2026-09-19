/**
 * Best-effort AIS (Annual Information Statement) analyzer.
 *
 * There is no public government API that lets a third-party app fetch someone's AIS using just
 * their PAN — the taxpayer has to log into the e-filing portal (Services -> Annual Information
 * Statement) themselves and download it. What we CAN do honestly is make it fast to turn that
 * downloaded data into pre-filled, reviewed income figures:
 *
 *  - Paste the AIS JSON (the portal offers a JSON download) or plain text (copied out of the PDF
 *    after unlocking it — the AIS PDF password is your PAN in lowercase followed by your date of
 *    birth as DDMMYYYY, e.g. "abcde1234f15051990").
 *  - This parser runs entirely in the browser (nothing is uploaded anywhere) and pulls out
 *    {description, amount} pairs, guesses which income field each belongs to, and hands back a
 *    flat list for the user to review, correct, and selectively apply — never applied silently.
 */

import { parseDocument, type DetectedLine, type FieldRule } from "./documentParser";

export type TargetField =
  | "salary.basicPlusDA"
  | "otherSources.savingsInterest"
  | "otherSources.fdInterest"
  | "otherSources.dividendIncome"
  | "otherSources.otherIncome"
  | "capitalGains.stcgEquity"
  | "capitalGains.ltcgEquity"
  | "capitalGains.stcgOther"
  | "capitalGains.ltcgOther"
  | "tdsAlreadyPaid"
  | "ignore";

export type { DetectedLine };

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  "salary.basicPlusDA": "Salary (basic + DA)",
  "otherSources.savingsInterest": "Savings account interest",
  "otherSources.fdInterest": "Fixed deposit interest",
  "otherSources.dividendIncome": "Dividend income",
  "otherSources.otherIncome": "Other income",
  "capitalGains.stcgEquity": "STCG — listed equity (Sec 111A)",
  "capitalGains.ltcgEquity": "LTCG — listed equity (Sec 112A)",
  "capitalGains.stcgOther": "Other short-term capital gains",
  "capitalGains.ltcgOther": "Other long-term capital gains",
  tdsAlreadyPaid: "TDS / TCS already paid",
  ignore: "Don't import this line",
};

// Order matters — more specific patterns first.
const RULES: FieldRule<TargetField>[] = [
  { test: /tds|tcs|tax deducted|tax collected/i, field: "tdsAlreadyPaid" },
  { test: /salary/i, field: "salary.basicPlusDA" },
  { test: /dividend/i, field: "otherSources.dividendIncome" },
  { test: /(saving.*(bank|account)|(bank|account).*saving)/i, field: "otherSources.savingsInterest" },
  { test: /(fixed|term|recurring)\s*deposit|\bfd\b/i, field: "otherSources.fdInterest" },
  {
    test: /(short.?term).*(equity|security|securities|share|mutual fund|units)|(equity|security|securities|share|mutual fund|units).*(short.?term)/i,
    field: "capitalGains.stcgEquity",
  },
  {
    test: /(long.?term).*(equity|security|securities|share|mutual fund|units)|(equity|security|securities|share|mutual fund|units).*(long.?term)/i,
    field: "capitalGains.ltcgEquity",
  },
  { test: /short.?term.*capital gain|capital gain.*short.?term/i, field: "capitalGains.stcgOther" },
  { test: /long.?term.*capital gain|capital gain.*long.?term/i, field: "capitalGains.ltcgOther" },
  { test: /interest/i, field: "otherSources.fdInterest" },
  { test: /rent|winning|lottery|professional|commission|other income/i, field: "otherSources.otherIncome" },
];

export function parseAisInput(raw: string): DetectedLine<TargetField>[] {
  return parseDocument(raw, RULES, "ignore", "ais");
}
