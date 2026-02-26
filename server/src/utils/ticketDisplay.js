import crypto from "crypto";

// Стабильный “случайный” номер 4 цифры: #1000..#9999
export function makeTicketDisplay(participantId) {
  const h = crypto.createHash("sha256").update(String(participantId)).digest("hex");
  const n = (parseInt(h.slice(0, 8), 16) % 9000) + 1000;
  return `#${n}`;
}