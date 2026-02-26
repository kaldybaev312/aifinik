import rateLimit from "express-rate-limit";

// Общий лимит на API (мягкий)
export const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 300,                 // 300 запросов / 10 минут / IP
  standardHeaders: true,
  legacyHeaders: false
});

// Жёсткий лимит на регистрацию (строже)
export const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 20,                  // 20 попыток / 10 минут / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Слишком много попыток. Подождите 10 минут." }
});

// Восстановление билета — тоже ограничим
export const restoreLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Слишком много запросов. Подождите 10 минут." }
});