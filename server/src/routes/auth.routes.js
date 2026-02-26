import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { ENV } from "../config/env.js";

const router = Router();

/*
POST /api/auth/login
body: { email, password }
*/
router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: "Email/password required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ ok: false, message: "Wrong credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ ok: false, message: "Wrong credentials" });
  }

  const token = jwt.sign(
    { uid: String(user._id), email: user.email, role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({ ok: true, token, role: user.role, email: user.email });
});

export default router;