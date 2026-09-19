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
> assets acquired before 23-Jul-2024, no presumptive taxation schemes). Always verify your final
> numbers before filing.

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
npm test        # runs the tax-engine unit tests (vitest)
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
- The app deliberately does not collect PAN, Aadhaar, or bank account numbers — the AI system
  prompt also instructs the assistant not to request them.
- Chat history is stored per user so the assistant has conversational context; it can be cleared
  via `DELETE /api/ai/chat`.
