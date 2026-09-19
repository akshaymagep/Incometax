import cors from "cors";
import "dotenv/config";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { returnsRouter } from "./routes/returns.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.use("/api/auth", authRouter);
app.use("/api/returns", returnsRouter);
app.use("/api/ai", aiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`IncomeTax AI server listening on http://localhost:${PORT}`);
});
