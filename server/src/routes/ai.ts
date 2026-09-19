import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { chatWithAssistant, generateSavingsPlan, suggestDeductions } from "../services/aiAssistant.js";
import { compareRegimes } from "../services/taxEngine.js";
import type { TaxProfile } from "../types.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  financialYear: z.string().optional(),
});

function loadProfile(userId: number, financialYear?: string): TaxProfile | undefined {
  if (!financialYear) return undefined;
  const row = db
    .prepare("SELECT profile_json FROM tax_returns WHERE user_id = ? AND financial_year = ?")
    .get(userId, financialYear) as { profile_json: string } | undefined;
  return row ? (JSON.parse(row.profile_json) as TaxProfile) : undefined;
}

aiRouter.get("/chat/:financialYear?", (req: AuthedRequest, res) => {
  const rows = db
    .prepare("SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC LIMIT 100")
    .all(req.userId) as { role: string; content: string; created_at: string }[];
  res.json({ messages: rows });
});

aiRouter.post("/chat", async (req: AuthedRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
  }
  const { message, financialYear } = parsed.data;
  const userId = req.userId as number;

  const historyRows = db
    .prepare("SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id ASC LIMIT 40")
    .all(userId) as { role: "user" | "assistant"; content: string }[];

  const profile = loadProfile(userId, financialYear);
  const comparison = profile ? compareRegimes(profile) : undefined;

  try {
    const reply = await chatWithAssistant([...historyRows, { role: "user", content: message }], profile, comparison);

    db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)").run(userId, message);
    db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)").run(userId, reply);

    res.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assistant is unavailable";
    res.status(502).json({ error: message });
  }
});

aiRouter.delete("/chat", (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM chat_messages WHERE user_id = ?").run(req.userId);
  res.status(204).send();
});

aiRouter.get("/suggest-deductions/:financialYear", async (req: AuthedRequest, res) => {
  const profile = loadProfile(req.userId as number, req.params.financialYear);
  if (!profile) {
    return res.status(404).json({ error: "No return found for this financial year. Save your income details first." });
  }
  const comparison = compareRegimes(profile);
  try {
    const suggestions = await suggestDeductions(profile, comparison);
    res.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assistant is unavailable";
    res.status(502).json({ error: message });
  }
});

aiRouter.get("/savings-plan/:financialYear", async (req: AuthedRequest, res) => {
  const profile = loadProfile(req.userId as number, req.params.financialYear);
  if (!profile) {
    return res.status(404).json({ error: "No return found for this financial year. Save your income details first." });
  }
  const comparison = compareRegimes(profile);
  try {
    const plan = await generateSavingsPlan(profile, comparison);
    res.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assistant is unavailable";
    res.status(502).json({ error: message });
  }
});
