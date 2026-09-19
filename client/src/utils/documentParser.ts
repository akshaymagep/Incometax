/**
 * Generic {description, amount} extractor shared by the AIS and Form 16 importers. Given a set of
 * keyword rules for a specific document type, it pulls candidate lines out of pasted JSON or plain
 * text. Runs entirely in the browser — callers decide what to do with the results (nothing is
 * applied to the tax return automatically).
 */

export interface DetectedLine<F extends string = string> {
  id: string;
  description: string;
  amount: number;
  suggestedField: F;
}

export interface FieldRule<F extends string> {
  test: RegExp;
  field: F;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,₹\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function guessField<F extends string>(description: string, rules: FieldRule<F>[], ignoreField: F): F {
  for (const rule of rules) {
    if (rule.test.test(description)) return rule.field;
  }
  return ignoreField;
}

function fromText<F extends string>(
  text: string,
  rules: FieldRule<F>[],
  ignoreField: F,
  idPrefix: string
): DetectedLine<F>[] {
  const lines = text.split(/\r?\n/);
  const results: DetectedLine<F>[] = [];
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
    results.push({ id: nextId(idPrefix), description, amount, suggestedField: guessField(description, rules, ignoreField) });
  }
  return results;
}

const AMOUNT_KEYS = /^(amount|amt|value|grossamount|totalamount|transactionamount)$/i;
const DESCRIPTION_KEYS = /^(description|desc|category|type|informationdescription|particulars|infocategory|name)$/i;

function fromJson<F extends string>(
  value: unknown,
  rules: FieldRule<F>[],
  ignoreField: F,
  idPrefix: string,
  results: DetectedLine<F>[]
): void {
  if (Array.isArray(value)) {
    for (const item of value) fromJson(item, rules, ignoreField, idPrefix, results);
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
      results.push({
        id: nextId(idPrefix),
        description,
        amount,
        suggestedField: guessField(description, rules, ignoreField),
      });
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") fromJson(val, rules, ignoreField, idPrefix, results);
    }
  }
}

export function parseDocument<F extends string>(
  raw: string,
  rules: FieldRule<F>[],
  ignoreField: F,
  idPrefix: string
): DetectedLine<F>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const results: DetectedLine<F>[] = [];
    fromJson(parsed, rules, ignoreField, idPrefix, results);
    if (results.length > 0) return results;
  } catch {
    // Not JSON — fall through to text parsing.
  }
  return fromText(trimmed, rules, ignoreField, idPrefix);
}
