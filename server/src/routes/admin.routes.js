import { Router } from "express";
import crypto from "crypto";

import { Code } from "../models/Code.js";
import { Participant } from "../models/Participant.js";
import { Draw } from "../models/Draw.js";

import { buildCardsPdf } from "../services/print.service.js";

const router = Router();

function formatTicketDisplay(ticketNumber) {
  if (!Number.isFinite(ticketNumber)) return "";
  return `#${String(ticketNumber).padStart(4, "0")}`;
}

/* =========================
   CODES: GENERATE
========================= */
// POST /api/admin/codes/generate
router.post("/codes/generate", async (req, res) => {
  const count = Math.min(Number(req.body.count || 0), 5000);
  if (!count || count < 1) return res.status(400).json({ ok: false, message: "count required" });

  const codes = [];
  for (let i = 0; i < count; i++) {
    // пример: XXXX-XXXX (8 символов + дефис)
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
    const token = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    codes.push({ token, status: "ACTIVE" });
  }

  const inserted = await Code.insertMany(codes);
  res.json({ ok: true, inserted: inserted.length });
});

/* =========================
   CODES: EXPORT CSV
========================= */
// GET /api/admin/codes/export.csv?status=ACTIVE
router.get("/codes/export.csv", async (req, res) => {
  const status = String(req.query.status || "").toUpperCase().trim();
  const filter = status ? { status } : {};

  const codes = await Code.find(filter).sort({ createdAt: 1 }).lean();

  const header = "code,status,createdAt,usedAt\n";
  const rows = codes
    .map((c) => {
      const createdAt = c.createdAt ? new Date(c.createdAt).toISOString() : "";
      const usedAt = c.usedAt ? new Date(c.usedAt).toISOString() : "";
      return `${c.token},${c.status},${createdAt},${usedAt}`;
    })
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="aifinik_codes_${status || "ALL"}.csv"`
  );
  res.send(header + rows + "\n");
});

/* =========================
   PRINT: PDF CARDS (40x40)
========================= */
// GET /api/admin/print/cards.pdf?status=ACTIVE&limit=1000
router.get("/print/cards.pdf", async (req, res) => {
  const status = String(req.query.status || "ACTIVE").toUpperCase();
  const limit = Math.min(Number(req.query.limit || 1000), 5000);

  const codes = await Code.find({ status }).sort({ createdAt: 1 }).limit(limit).lean();
  if (!codes.length) return res.status(404).json({ ok: false, message: "Нет кодов для печати." });

  const pdfBuffer = await buildCardsPdf({ codes });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="aifinik_cards_${limit}.pdf"`);
  res.send(pdfBuffer);
});

/* =========================
   PARTICIPANTS (ADMIN)
========================= */
// GET /api/admin/participants?limit=500
router.get("/participants", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 2000);

  const items = await Participant.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  const mapped = items.map((p) => ({
    ...p,
    ticketDisplay: formatTicketDisplay(p.ticketNumber),
  }));

  res.json({ ok: true, items: mapped });
});

/* =========================
   DRAWS: CREATE / LIST / RUN
   без seed, с prizesCount
========================= */

// POST /api/admin/draws
// body: { name, drawAtISO, prizesCount }
router.post("/draws", async (req, res) => {
  const name = String(req.body.name || "Aifinik Draw").trim();
  const drawAtISO = String(req.body.drawAtISO || "").trim();
  const prizesCount = Math.max(1, Math.min(10, Number(req.body.prizesCount || 1)));

  if (!drawAtISO) return res.status(400).json({ ok: false, message: "drawAtISO required" });

  const drawAt = new Date(drawAtISO);
  if (Number.isNaN(drawAt.getTime()))
    return res.status(400).json({ ok: false, message: "Invalid drawAtISO" });

  const d = await Draw.create({ name, drawAt, prizesCount });
  res.json({ ok: true, id: String(d._id), name: d.name, drawAt: d.drawAt.toISOString(), prizesCount });
});

// GET /api/admin/draws
router.get("/draws", async (req, res) => {
  const items = await Draw.find({}).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, items });
});

// POST /api/admin/draws/:id/run
// Выдаёт winners по местам. Показ в шоу делаем "по одному" до главного приза.
router.post("/draws/:id/run", async (req, res) => {
  const draw = await Draw.findById(req.params.id);
  if (!draw) return res.status(404).json({ ok: false, message: "Draw not found" });

  const participants = await Participant.find({}).sort({ createdAt: 1 }).lean();
  const N = participants.length;
  if (N === 0) return res.status(400).json({ ok: false, message: "No participants" });

  // Если уже есть победители — возвращаем тех же (чтобы не "переигрывать")
  if (draw.winners?.length) {
    // соберем данные победителей
    const winnersFull = draw.winners
      .slice()
      .sort((a, b) => a.place - b.place)
      .map((w) => {
        const p = participants.find((x) => String(x._id) === String(w.participantId));
        const ticketDisplay = p
          ? formatTicketDisplay(p.ticketNumber)
          : (w.ticketDisplay || "");
        return {
          place: w.place,
          ticketDisplay,
          ticketNumber: p?.ticketNumber,
          fullName: p?.fullName || "",
          phoneE164: p?.phoneE164 || "",
          codeToken: p?.codeToken || "",
        };
      });

    return res.json({
      ok: true,
      draw: { id: String(draw._id), name: draw.name, drawAt: draw.drawAt.toISOString(), prizesCount: draw.prizesCount },
      totalParticipants: draw.totalParticipants || N,
      audit: { randomHash: draw.randomHash },
      winners: winnersFull,
    });
  }

  const prizes = Math.min(draw.prizesCount || 1, N);

  // Перемешиваем индексы честно (crypto.randomInt)
  const idxs = Array.from({ length: N }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }

  // Выбираем победителей:
  // place=1 — главный приз
  // Но для шоу мы будем показывать в порядке: place=prizes ... 2 ... 1
  const winners = [];
  for (let place = 1; place <= prizes; place++) {
    const p = participants[idxs[place - 1]];
    winners.push({
      place,
      participantId: p._id,
      ticketDisplay: formatTicketDisplay(p.ticketNumber),
      ticketNumber: p.ticketNumber,
      fullName: p.fullName,
      phoneE164: p.phoneE164,
      codeToken: p.codeToken,
    });
  }

  // audit hash (без seed)
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = new Date().toISOString();
  const randomHash = crypto
    .createHash("sha256")
    .update(`${nonce}|${String(draw._id)}|${N}|${ts}`)
    .digest("hex");

  draw.winners = winners.map((w) => ({
    place: w.place,
    participantId: w.participantId,
    ticketDisplay: w.ticketDisplay,
  }));
  draw.totalParticipants = N;
  draw.randomNonce = nonce;
  draw.randomHash = randomHash;
  await draw.save();

  res.json({
    ok: true,
    draw: { id: String(draw._id), name: draw.name, drawAt: draw.drawAt.toISOString(), prizesCount: draw.prizesCount },
    totalParticipants: N,
    audit: { randomHash },
    winners: winners.map(({ participantId, ...rest }) => rest), // наружу без participantId
  });
});

export default router;
