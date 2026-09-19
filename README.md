# IncomeTax AI

An AI-assisted planning tool that helps individual taxpayers in India understand their income
tax liability and prepare their Income Tax Return (ITR). It computes tax under both the **old**
and **new** tax regimes for FY 2024-25 (AY 2025-26), recommends the better option, and offers an
AI chat assistant (powered by Claude) for questions, deduction suggestions, and "what-if"
guidance.

> **Disclaimer:** This is a planning and education tool, not the official Income Tax Department
> e-filing portal and not a substitute for a qualified chartered accountant. It does not submit
> anything to the government. Several simplifications are documented in
> `server/src/services/taxEngine.ts` (no surcharge marginal relief, no indexation on capital
> assets acquired before 23-Jul-2024). Always verify your final numbers before filing.

## Architecture

```
Incometax/
  server/   Express + TypeScript API, SQLite persistence, tax engine, Claude integration
  client/   React + TypeScript + Vite + Tailwind SPA
```

- **Tax engine** (`server/src/services/taxEngine.ts`): pure functions that compute HRA exemption,
  house-property income, Chapter VI-A deductions, slab tax, capital-gains special rates, Section
  87A rebate, surcharge, and cess for both regimes. Covered by unit tests
  (`server/src/services/taxEngine.test.ts`).
- **API** (`server/src/routes`): JWT-based auth, per-user tax-return storage keyed by financial
  year, and AI endpoints that ground Claude's responses in the user's saved tax profile and
  computed results.
- **AI assistant** (`server/src/services/aiAssistant.ts`): wraps the Anthropic Messages API with a
  system prompt scoped to Indian personal income tax, and injects the user's current numbers as
  context so answers and deduction suggestions are specific to them.
- **Frontend** (`client/src`): a guided flow (Personal Info → Income → Deductions → Summary) plus
  a floating chat widget available on every page.
- **ITR-1 through ITR-4** (`server/src/services/itrExport.ts`'s `determineApplicableForm`): the app
  works out which form applies from what you've entered — ITR-1 (simple salaried), ITR-2 (adds
  capital gains, or a non-resident), ITR-3 (business/professional income with regular books of
  account, or presumptive income outside its limits), or ITR-4/Sugam (presumptive business under
  Section 44AD, or professional income under 44ADA, within the turnover limits and minimum-profit
  requirement). The Income page's Business/Profession section includes a presumptive-scheme
  calculator (turnover, digital-receipts toggle, minimum profit required) that feeds this directly.
- **Filing export** ("Filing export" section on the Summary page): generates
  1. a **filing worksheet** (JSON) that organizes your numbers under the same schedule names the
     ITR forms and e-filing portal use (Schedule S/HP/CG/OS/VI-A/BP, Part B-TI/TTI) for whichever
     form applies — always safe to generate, for all four forms; and
  2. for the two simplest forms — **ITR-1** (simple salaried) and **ITR-4** (presumptive
     business/professional) — a **best-effort draft JSON** shaped like the offline utility's
     schema. ITR-2 and ITR-3 deliberately don't get this draft: their real schemas carry
     asset-wise capital-gains detail, foreign-asset schedules, and audit particulars this app
     doesn't collect, so guessing at them risks a confidently-wrong file. Whichever draft is
     offered is explicitly labeled experimental: the Department's exact schema (including a
     proprietary checksum/digest block) changes every assessment year and isn't reproduced here,
     so **do not upload it directly** — use it to cross-check figures against what you enter in
     the official utility or portal.
- **AIS import** (`client/src/utils/aisParser.ts`, "Import from your AIS" panel on the Income
  page): there is no government API that lets an app fetch your Annual Information Statement from
  just your PAN — you have to download it yourself from the e-filing portal (Services → Annual
  Information Statement). This feature makes using it fast once you have it: paste the AIS JSON
  export or text copied from the PDF, and the app detects `{description, amount}` pairs, guesses
  which income field each belongs to (salary, savings/FD interest, dividends, capital gains, TDS),
  and shows a review table where you confirm/correct the mapping before anything is applied to
  your return. It runs entirely in the browser — nothing is uploaded to the server. Importing data
  that reveals a new income type (e.g. capital gains) immediately updates the recommended ITR form
  once saved.
- **Form 16 import** (`client/src/utils/form16Parser.ts`, "Import from your Form 16" panel on the
  Income page): Form 16 Part B is issued directly by your employer and reports gross salary,
  Section 16 deductions (professional tax), and the Chapter VI-A deductions your employer applied,
  plus total TDS. Paste the text or upload it and the app detects and lets you selectively apply
  those figures — same review-before-apply UX as the AIS importer, same "runs entirely in your
  browser" guarantee. Only fields with an unambiguous mapping are offered (professional tax, 80C,
  80CCD(1B), 80D, TDS); gross salary is offered too but flagged, since Form 16 reports one combined
  salary figure rather than this app's Basic+DA/HRA/other-allowances split used for its own HRA
  exemption calculation.
- **Tax Planning** (`client/src/pages/TaxPlanning.tsx`, `client/src/utils/taxPlanning.ts`, `/planning`
  route): a forward-looking section with
  1. remaining headroom in 80C/80CCD(1B)/80D against this year's statutory caps, and the
     approximate tax it's worth at your marginal rate;
  2. a one-click check for whether maxing out old-regime deductions would flip the regime
     recommendation (calls the real `/compute` endpoint, not a client-side approximation);
  3. a "what-if" projector for next year (expected salary growth, planned extra 80C/80CCD(1B))
     using this year's slab rules as a stand-in; and
  4. an AI-generated short savings plan for next year.

## Setup

Requires Node.js 20+.

```bash
npm run install:all        # installs server/ and client/ dependencies
cp server/.env.example server/.env
```

Edit `server/.env`:

```
PORT=4000
JWT_SECRET=<generate a long random string>
ANTHROPIC_API_KEY=<your Anthropic API key>   # optional — AI features are disabled without it
CLIENT_ORIGIN=http://localhost:5173
```

Get an Anthropic API key at https://console.anthropic.com. Without it, everything except the AI
chat and "check for missed deductions" features works normally (the tax computation is 100% local
and does not require the API key).

## Running

```bash
npm run dev     # runs server (port 4000) and client (port 5173) together
```

Open http://localhost:5173, create an account, and walk through the four steps. The Vite dev
server proxies `/api/*` to the Express backend.

## Testing

```bash
npm test        # runs server (tax engine, filing export) and client (AIS parser, tax planning) unit tests
```

## Building for production

```bash
npm run build   # builds both server (tsc) and client (vite build)
```

Serve `client/dist` with any static host and run `node server/dist/index.js` (with the same
environment variables) behind it, or behind a reverse proxy that forwards `/api` to the server.

## Data & privacy

- Tax profiles are stored in a local SQLite database (`server/data/incometax.sqlite`), scoped per
  authenticated user.
- Name and PAN are optional and stored locally only, to prefill the filing worksheet/draft export;
  the app never transmits them anywhere else. Aadhaar and bank account numbers are not collected at
  all, and the AI system prompt instructs the assistant not to request them.
- Chat history is stored per user so the assistant has conversational context; it can be cleared
  via `DELETE /api/ai/chat`.
