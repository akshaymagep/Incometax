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

export interface DetectedLine {
  id: string;
  description: string;
  amount: number;
  suggestedField: TargetField;
}

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

interface Rule {
  test: RegExp;
  field: TargetField;
}

// Order matters — more specific patterns first.
const RULES: Rule[] = [
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

function guessField(description: string): TargetField {
  for (const rule of RULES) {
    if (rule.test.test(description)) return rule.field;
  }
  return "ignore";
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `ais-${idCounter}`;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,₹\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fromText(text: string): DetectedLine[] {
  const lines = text.split(/\r?\n/);
  const results: DetectedLine[] = [];
  // Matches a line ending in a currency-looking number, capturing the leading description.
  const lineRe = /^(.{4,}?)[\s:|]+(?:rs\.?|inr|₹)?\s*(-?[\d,]+(?:\.\d+)?)\s*$/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(lineRe);
    if (!match) continue;
    const description = match[1].trim();
    const amount = parseAmount(match[2]);
    if (amount === null || amount <= 0) continue;
    if (/^(page|total|sr\.?\s*no|s\.?\s*no)$/i.test(description)) continue;
    results.push({ id: nextId(), description, amount, suggestedField: guessField(description) });
  }
  return results;
}

const AMOUNT_KEYS = /^(amount|amt|value|grossamount|totalamount|transactionamount)$/i;
const DESCRIPTION_KEYS = /^(description|desc|category|type|informationdescription|particulars|infocategory|name)$/i;

function fromJson(value: unknown, results: DetectedLine[]): void {
  if (Array.isArray(value)) {
    for (const item of value) fromJson(item, results);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let description: string | undefined;
    let amount: number | undefined;
    for (const [key, val] of Object.entries(obj)) {
      if (description === undefined && DESCRIPTION_KEYS.test(key) && typeof val === "string") {
        description = val;
      }
      if (amount === undefined) {
        if (AMOUNT_KEYS.test(key)) {
          if (typeof val === "number") amount = val;
          else if (typeof val === "string") amount = parseAmount(val) ?? undefined;
        }
      }
    }
    if (description && amount !== undefined && amount > 0) {
      results.push({ id: nextId(), description, amount, suggestedField: guessField(description) });
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") fromJson(val, results);
    }
  }
}

export function parseAisInput(raw: string): DetectedLine[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const results: DetectedLine[] = [];
    fromJson(parsed, results);
    if (results.length > 0) return results;
  } catch {
    // Not JSON — fall through to text parsing.
  }
  return fromText(trimmed);
}
