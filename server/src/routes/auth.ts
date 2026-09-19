import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { signToken } from "../middleware/auth.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
});

authRouter.post("/register", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { email, password, name } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(email, passwordHash, name ?? "");

  const userId = Number(result.lastInsertRowid);
  const token = signToken(userId);
  res.status(201).json({ token, user: { id: userId, email, name: name ?? "" } });
});

authRouter.post("/login", (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const { email, password } = parsed.data;

  const user = db
    .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; name: string; password_hash: string } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});
