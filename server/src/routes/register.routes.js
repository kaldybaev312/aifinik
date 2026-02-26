import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { Code } from "../models/Code.js";
import { Participant } from "../models/Participant.js";
import { normalizeKGPhone } from "../utils/phone.js";
import {
  makeThrottleKeys,
  isBlocked,
  recordWrong,
  resetWrong,
} from "../middleware/throttle.js";

const router = Router();

const TICKET_MIN = 1000;
const TICKET_POOL_SIZE = 9000; // 1000..9999
const MAX_TICKET_PICK_ATTEMPTS = 80;

function randomTicketNumber() {
  return crypto.randomInt(TICKET_MIN, TICKET_MIN + TICKET_POOL_SIZE);
}

/*
POST /api/public/register
body: { fullName, phone, code }
*/
router.post("/register", async (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const code = String(req.body.code || "")
    .trim()
    .toUpperCase();
  const phoneRaw = req.body.phone;

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ ok: false, message: "Введите ФИО" });
  }
  if (!code || code.length < 4) {
    return res.status(400).json({ ok: false, message: "Введите код" });
  }

  let phoneE164;
  try {
    phoneE164 = normalizeKGPhone(phoneRaw);
  } catch {
    return res
      .status(400)
      .json({ ok: false, message: "Неверный номер телефона" });
  }

  const keys = makeThrottleKeys(req, phoneE164);

  const blockedUntil = await isBlocked(keys);
  if (blockedUntil) {
    return res.status(429).json({
      ok: false,
      message: `Слишком много неверных попыток. Попробуйте позже.`,
      blockedUntil,
    });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1) телефон должен быть уникальным
    const existingPhone = await Participant.findOne({ phoneE164 }).session(
      session,
    );
    if (existingPhone) {
      await session.abortTransaction();
      return res.status(409).json({
        ok: false,
        message: "Этот номер уже зарегистрирован (1 номер = 1 билет).",
      });
    }

    // 2) код должен быть ACTIVE, и сразу помечаем USED (атомарно)
    const updatedCode = await Code.findOneAndUpdate(
      { token: code, status: "ACTIVE" },
      { $set: { status: "USED", usedAt: new Date() } },
      { new: true, session },
    );

    if (!updatedCode) {
      await session.abortTransaction();

      // записываем ошибку (5 ошибок -> блок 15 минут)
      await recordWrong(keys, { maxWrong: 5, blockMinutes: 15 });

      return res.status(400).json({
        ok: false,
        message: "Код недействителен или уже использован.",
      });
    }

    // 3) ticketNumber: случайный уникальный #1000..#9999
    const participantsCount = await Participant.countDocuments({}).session(session);
    if (participantsCount >= TICKET_POOL_SIZE) {
      await session.abortTransaction();
      return res.status(503).json({
        ok: false,
        message: "Свободные номера билетов закончились.",
      });
    }

    let ticketNumber = null;
    for (let i = 0; i < MAX_TICKET_PICK_ATTEMPTS; i++) {
      const candidate = randomTicketNumber();
      const exists = await Participant.exists({ ticketNumber: candidate }).session(session);
      if (!exists) {
        ticketNumber = candidate;
        break;
      }
    }

    if (!ticketNumber) {
      await session.abortTransaction();
      return res.status(503).json({
        ok: false,
        message: "Не удалось подобрать свободный номер билета. Попробуйте еще раз.",
      });
    }

    // 4) создаём участника
    const participant = await Participant.create(
      [
        {
          _id: new mongoose.Types.ObjectId(),
          fullName,
          phoneE164,
          ticketNumber,
          codeToken: code,
        },
      ],
      { session },
    );

    const participantId = participant[0]._id;

    // 5) привязываем participantId к коду
    await Code.updateOne(
      { _id: updatedCode._id },
      { $set: { participantId } },
      { session },
    );

    await session.commitTransaction();
    await resetWrong(keys);

    const ticketStr = String(ticketNumber).padStart(4, "0");

    res.json({
      ok: true,
      ticketNumber,
      ticketDisplay: `#${ticketStr}`,
      kg: `✅ Каттоо кабыл алынды (Aifinik). Сиздин билет: #${ticketStr}`,
      ru: `✅ Регистрация принята (Aifinik). Ваш билет: #${ticketStr}`,
    });
  } catch (err) {
    await session.abortTransaction();

    // на случай дублей по индексу
    if (String(err?.code) === "11000") {
      return res.status(409).json({
        ok: false,
        message: "Дубликат данных (телефон/код уже используется).",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  } finally {
    session.endSession();
  }
});

export default router;
