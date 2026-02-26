import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET);
    req.user = payload; // { uid, email, role }
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    next();
  };
}