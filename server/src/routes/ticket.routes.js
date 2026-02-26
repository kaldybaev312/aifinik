import { Router } from "express";
import { Participant } from "../models/Participant.js";
import { normalizeKGPhone } from "../utils/phone.js";
import { ENV } from "../config/env.js";

const router = Router();

// GET /api/public/config
router.get("/config", (req, res) => {
  res.json({
    ok: true,
    brand: "Aifinik",
    drawAt: ENV.DRAW_AT || null
  });
});

// POST /api/public/ticket-by-phone
// body: { phone }
router.post("/ticket-by-phone", async (req, res) => {
  let phoneE164;
  try {
    phoneE164 = normalizeKGPhone(req.body.phone);
  } catch {
    return res.status(400).json({ ok: false, message: "Неверный номер телефона" });
  }

  const p = await Participant.findOne({ phoneE164 }).lean();

  if (!p) {
    return res.status(404).json({ ok: false, message: "Билет по этому номеру не найден." });
  }

  const ticketStr = String(p.ticketNumber).padStart(4, "0");

  return res.json({
    ok: true,
    ticketNumber: p.ticketNumber,
    ticketDisplay: `#${ticketStr}`,
    fullName: p.fullName,
    phoneE164: p.phoneE164,
    codeToken: p.codeToken,
    ru: `✅ Регистрация принята (Aifinik). Ваш билет: #${ticketStr}`,
    kg: `✅ Каттоо кабыл алынды (Aifinik). Сиздин билет: #${ticketStr}`
  });
});

export default router;
