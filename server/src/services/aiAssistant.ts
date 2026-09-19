import Anthropic from "@anthropic-ai/sdk";
import type { ComparisonResult, TaxProfile } from "../types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured on the server. Set it in server/.env to enable the AI assistant."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are an AI assistant embedded in an Indian personal income-tax filing helper app.
You help individual taxpayers (salaried employees, freelancers, small investors) understand their
tax situation, choose between the old and new tax regimes, and identify legitimate deductions
they may be missing (Section 80C, 80D, 80CCD(1B), HRA, home loan interest under Section 24(b),
80TTA/80TTB, 80G, 80E, capital gains rules, etc.) for Financial Year 2024-25 (Assessment Year 2025-26).

Rules you must follow:
- Be concise, practical, and use plain language. Use INR with the Indian numbering convention (lakhs/crores) when it helps.
- You are a planning aid, not a chartered accountant or the official Income Tax Department e-filing portal.
  Do not claim to file returns on the user's behalf. When a question involves complex or high-stakes
  situations (large foreign income, litigation, business tax audits, penalties), recommend consulting
  a qualified chartered accountant in addition to your answer.
- When the user's tax profile/computation is included in context, ground your answer in those numbers
  and reference specific sections of the Income Tax Act where relevant.
- Never fabricate tax law. If unsure of a specific rule, say so plainly instead of guessing.
- Do not ask for or store sensitive identifiers (PAN, Aadhaar, bank account numbers, passwords).`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function profileContextBlock(profile?: TaxProfile, comparison?: ComparisonResult): string {
  if (!profile) return "";
  const lines = [
    `Financial year: ${profile.financialYear}`,
    `Age band: ${profile.ageBand}`,
    `Salary (basic+DA): ₹${profile.salary.basicPlusDA}, HRA received: ₹${profile.salary.hraReceived}, rent paid: ₹${profile.salary.rentPaid}`,
    `House property: ${profile.houseProperty.isSelfOccupied ? "self-occupied" : "let-out"}, home loan interest: ₹${profile.houseProperty.homeLoanInterest}`,
    `Capital gains - STCG equity: ₹${profile.capitalGains.stcgEquity}, LTCG equity: ₹${profile.capitalGains.ltcgEquity}`,
    `Other income (interest/dividend/misc): ₹${
      profile.otherSources.savingsInterest + profile.otherSources.fdInterest + profile.otherSources.dividendIncome + profile.otherSources.otherIncome
    }`,
    `Deductions claimed - 80C: ₹${profile.deductions.section80C}, 80CCD(1B): ₹${profile.deductions.section80CCD1B}, 80D self: ₹${profile.deductions.section80D_self}, 80D parents: ₹${profile.deductions.section80D_parents}`,
    `TDS already paid: ₹${profile.tdsAlreadyPaid}, advance tax paid: ₹${profile.advanceTaxPaid}`,
  ];
  if (comparison) {
    lines.push(
      `Computed old regime tax: ₹${comparison.old.totalTaxLiability}, new regime tax: ₹${comparison.new.totalTaxLiability}`,
      `Recommended regime: ${comparison.recommended} (saves ₹${comparison.savingsAmount})`
    );
  }
  return `Here is the user's current tax profile and computation for context:\n${lines.join("\n")}`;
}

export async function chatWithAssistant(
  history: ChatTurn[],
  profile?: TaxProfile,
  comparison?: ComparisonResult
): Promise<string> {
  const anthropic = getClient();
  const contextBlock = profileContextBlock(profile, comparison);

  const messages: Anthropic.MessageParam[] = [];
  if (contextBlock) {
    messages.push({ role: "user", content: contextBlock });
    messages.push({ role: "assistant", content: "Understood, I'll use this context to inform my answers." });
  }
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

export async function suggestDeductions(profile: TaxProfile, comparison: ComparisonResult): Promise<string> {
  const anthropic = getClient();
  const contextBlock = profileContextBlock(profile, comparison);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\nBased on this profile, list any tax-saving opportunities, deductions,
or exemptions the user may be missing or under-utilizing (only under the old regime where applicable,
since most deductions don't apply under the new regime). Also flag anything that looks like a data
entry mistake (e.g. unusually high or inconsistent numbers). Format as a short bulleted list, each
bullet starting with the relevant section number in bold where applicable. Keep it under 200 words.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
