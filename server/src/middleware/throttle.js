import { Throttle } from "../models/Throttle.js";

function getIp(req) {
  // Используем req.ip; при включенном trust proxy Express сам возьмёт X-Forwarded-For
  return (req.ip || "").trim();
}

export function makeThrottleKeys(req, phoneE164) {
  const ip = getIp(req);
  const keys = [];
  if (ip) keys.push(`ip:${ip}`);
  if (phoneE164) keys.push(`phone:${phoneE164}`);
  return keys;
}

export async function isBlocked(keys) {
  const now = new Date();
  const docs = await Throttle.find({ key: { $in: keys } }).lean();
  for (const d of docs) {
    if (d.blockedUntil && new Date(d.blockedUntil).getTime() > now.getTime()) {
      return d.blockedUntil;
    }
  }
  return null;
}

export async function recordWrong(keys, opts = {}) {
  const {
    maxWrong = 5,
    blockMinutes = 15
  } = opts;

  const now = new Date();
  const blockedUntil = new Date(now.getTime() + blockMinutes * 60 * 1000);

  for (const key of keys) {
    const doc = await Throttle.findOne({ key });

    if (!doc) {
      await Throttle.create({
        key,
        wrongCount: 1,
        lastWrongAt: now,
        blockedUntil: null
      });
      continue;
    }

    // если уже заблокирован — не меняем
    if (doc.blockedUntil && doc.blockedUntil.getTime() > now.getTime()) {
      continue;
    }

    doc.wrongCount = (doc.wrongCount || 0) + 1;
    doc.lastWrongAt = now;

    if (doc.wrongCount >= maxWrong) {
      doc.blockedUntil = blockedUntil;
      doc.wrongCount = 0; // сбрасываем после блокировки
    }

    await doc.save();
  }
}

export async function resetWrong(keys) {
  // при успешной регистрации — обнуляем счётчик ошибок
  await Throttle.updateMany(
    { key: { $in: keys } },
    { $set: { wrongCount: 0, blockedUntil: null } }
  );
}
