import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { buildDraftItr1, buildFilingWorksheet, determineApplicableForm } from "../services/itrExport.js";
import { compareRegimes } from "../services/taxEngine.js";
import type { TaxProfile } from "../types.js";

export const returnsRouter = Router();
returnsRouter.use(requireAuth);

const num = () => z.number().finite().nonnegative();

const panRegex = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/;

const taxProfileSchema = z.object({
  financialYear: z.string().min(4),
  ageBand: z.enum(["below60", "60to80", "above80"]),
  personalInfo: z.object({
    fullName: z.string().max(200),
    pan: z.string().refine((v) => v === "" || panRegex.test(v), "PAN must look like ABCDE1234F"),
    dateOfBirth: z.string().max(20),
    residentialStatus: z.enum(["resident", "nonResident", "notOrdinarilyResident"]),
  }),
  salary: z.object({
    basicPlusDA: num(),
    hraReceived: num(),
    rentPaid: num(),
    isMetro: z.boolean(),
    otherAllowances: num(),
    employerNpsContribution: num(),
  }),
  houseProperty: z.object({
    isSelfOccupied: z.boolean(),
    annualRentReceived: num(),
    municipalTaxesPaid: num(),
    homeLoanInterest: num(),
  }),
  capitalGains: z.object({
    stcgEquity: num(),
    ltcgEquity: num(),
    stcgOther: num(),
    ltcgOther: num(),
  }),
  otherSources: z.object({
    savingsInterest: num(),
    fdInterest: num(),
    dividendIncome: num(),
    otherIncome: num(),
  }),
  business: z.object({ netProfit: num() }),
  deductions: z.object({
    section80C: num(),
    section80CCD1B: num(),
    section80D_self: num(),
    section80D_parents: num(),
    parentsAreSenior: z.boolean(),
    section80TTA_TTB: num(),
    section80G: num(),
    section80E: num(),
    otherDeductions: num(),
  }),
  tdsAlreadyPaid: num(),
  advanceTaxPaid: num(),
});

interface ReturnRow {
  id: number;
  financial_year: string;
  profile_json: string;
  updated_at: string;
}

returnsRouter.get("/", (req: AuthedRequest, res) => {
  const rows = db
    .prepare("SELECT id, financial_year, profile_json, updated_at FROM tax_returns WHERE user_id = ? ORDER BY financial_year DESC")
    .all(req.userId) as ReturnRow[];
  res.json(
    rows.map((r) => ({
      id: r.id,
      financialYear: r.financial_year,
      updatedAt: r.updated_at,
      profile: JSON.parse(r.profile_json) as TaxProfile,
    }))
  );
});

returnsRouter.get("/:financialYear", (req: AuthedRequest, res) => {
  const row = db
    .prepare("SELECT id, financial_year, profile_json, updated_at FROM tax_returns WHERE user_id = ? AND financial_year = ?")
    .get(req.userId, req.params.financialYear) as ReturnRow | undefined;
  if (!row) return res.status(404).json({ error: "No return found for this financial year" });
  res.json({
    id: row.id,
    financialYear: row.financial_year,
    updatedAt: row.updated_at,
    profile: JSON.parse(row.profile_json) as TaxProfile,
  });
});

returnsRouter.put("/:financialYear", (req: AuthedRequest, res) => {
  const parsed = taxProfileSchema.safeParse({ ...req.body, financialYear: req.params.financialYear });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid tax profile", issues: parsed.error.issues });
  }
  const profile = parsed.data as TaxProfile;
  db.prepare(
    `INSERT INTO tax_returns (user_id, financial_year, profile_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, financial_year)
     DO UPDATE SET profile_json = excluded.profile_json, updated_at = datetime('now')`
  ).run(req.userId, req.params.financialYear, JSON.stringify(profile));

  const comparison = compareRegimes(profile);
  res.json({ profile, comparison });
});

returnsRouter.post("/:financialYear/compute", (req: AuthedRequest, res) => {
  const parsed = taxProfileSchema.safeParse({ ...req.body, financialYear: req.params.financialYear });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid tax profile", issues: parsed.error.issues });
  }
  const comparison = compareRegimes(parsed.data as TaxProfile);
  res.json({ comparison });
});

returnsRouter.get("/:financialYear/export", (req: AuthedRequest, res) => {
  const row = db
    .prepare("SELECT profile_json FROM tax_returns WHERE user_id = ? AND financial_year = ?")
    .get(req.userId, req.params.financialYear) as { profile_json: string } | undefined;
  if (!row) return res.status(404).json({ error: "No return found for this financial year. Save your details first." });

  const profile = JSON.parse(row.profile_json) as TaxProfile;
  const comparison = compareRegimes(profile);
  const applicability = determineApplicableForm(profile);
  const worksheet = buildFilingWorksheet(profile, comparison);
  const draftItr1 = buildDraftItr1(profile, comparison);

  res.json({ applicability, worksheet, draftItr1 });
});

returnsRouter.delete("/:financialYear", (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM tax_returns WHERE user_id = ? AND financial_year = ?").run(req.userId, req.params.financialYear);
  res.status(204).send();
});
