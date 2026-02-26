import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ 57×40 мм (альбом)
const MM_TO_PT = 2.83465;
const CARD_W = 57 * MM_TO_PT;
const CARD_H = 40 * MM_TO_PT;

const PAD = 2.5 * MM_TO_PT;

function resolveAssetPath(envValue, candidates) {
  if (envValue && fs.existsSync(envValue)) return envValue;
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const BG_PATH = resolveAssetPath(process.env.PRINT_BG_PATH, [
  path.resolve(__dirname, "../../assets/imgs/card-bg.png"), // server/src/services -> server/assets
  path.resolve(__dirname, "../assets/imgs/card-bg.png"), // server/dist/services -> server/assets
  path.resolve(process.cwd(), "server/assets/imgs/card-bg.png"),
  path.resolve(process.cwd(), "assets/imgs/card-bg.png"),
]);

const FONT_PATH = resolveAssetPath(process.env.PRINT_FONT_PATH, [
  path.resolve(__dirname, "../../assets/fonts/myFont.ttf"), // server/src/services -> server/assets
  path.resolve(__dirname, "../assets/fonts/myFont.ttf"), // server/dist/services -> server/assets
  path.resolve(process.cwd(), "server/assets/fonts/myFont.ttf"),
  path.resolve(process.cwd(), "assets/fonts/myFont.ttf"),
]);

const ENTRY_URL_BASE =
  process.env.PRINT_ENTRY_BASE_URL ||
  process.env.APP_URL ||
  "http://localhost:8080";

let didLogAssetStatus = false;

function logAssetStatusOnce() {
  if (didLogAssetStatus) return;
  didLogAssetStatus = true;
  if (!BG_PATH) {
    console.warn("[print.service] Card background not found. Using solid fallback.");
  }
  if (!FONT_PATH) {
    console.warn("[print.service] Cyrillic font not found. Using English text fallback.");
  }
  if (/localhost|127\.0\.0\.1/i.test(ENTRY_URL_BASE)) {
    console.warn("[print.service] ENTRY URL points to localhost. Set PRINT_ENTRY_BASE_URL for production.");
  }
}

function registerFont(doc) {
  if (!FONT_PATH) return false;
  try {
    doc.registerFont("AIF_FONT", FONT_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function buildCardsPdf({ codes }) {
  return new Promise(async (resolve) => {
    logAssetStatusOnce();

    const doc = new PDFDocument({ size: "A4", margin: 0 });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const hasFont = registerFont(doc);

    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;

    const COLS = Math.floor(PAGE_W / CARD_W);
    const ROWS = Math.floor(PAGE_H / CARD_H);

    for (let i = 0; i < codes.length; i++) {
      if (i > 0 && i % (COLS * ROWS) === 0) doc.addPage();

      const col = i % COLS;
      const row = Math.floor(i / COLS) % ROWS;

      const x = col * CARD_W;
      const y = row * CARD_H;

      await drawCard(doc, x, y, codes[i].token, hasFont);
    }

    doc.end();
  });
}

function buildEntryUrl(token) {
  const base = ENTRY_URL_BASE.endsWith("/")
    ? ENTRY_URL_BASE.slice(0, -1)
    : ENTRY_URL_BASE;
  return `${base}/enter.html?c=${encodeURIComponent(token)}`;
}

async function drawCard(doc, x, y, token, hasFont) {
  const R = 8;
  const font = hasFont ? "AIF_FONT" : "Helvetica";
  const titlePanelH = 24;
  const bottomPanelH = 15;

  // ===== 1) ФОН + СКРУГЛЕНИЕ =====
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, R).clip();

  if (BG_PATH) {
    doc.image(BG_PATH, x, y, { width: CARD_W, height: CARD_H });
  } else {
    // fallback (если фон не найден)
    doc.rect(x, y, CARD_W, CARD_H).fill("#071225");
  }

  // затемнение для читаемости текста поверх фото
  doc.rect(x, y, CARD_W, CARD_H).fillOpacity(0.18).fill("#000").fillOpacity(1);

  // локальные плашки контраста под заголовок и нижний блок
  doc.roundedRect(x + 2, y + 2, CARD_W - 4, titlePanelH, 6)
    .fillOpacity(0.40).fill("#031021").fillOpacity(1);
  doc.roundedRect(x + 2, y + CARD_H - bottomPanelH - 2, CARD_W - 4, bottomPanelH, 6)
    .fillOpacity(0.52).fill("#030712").fillOpacity(1);
  doc.restore();

  // ===== 2) РАМКА =====
  doc
    .roundedRect(x + 1.3, y + 1.3, CARD_W - 2.6, CARD_H - 2.6, R - 1)
    .lineWidth(0.9)
    .strokeOpacity(0.35)
    .stroke("#FFFFFF")
    .strokeOpacity(1);

  const text = hasFont
    ? {
      title: "ДАРИМ ПОЕЗДКУ В ТАШКЕНТ!",
      scan: "СКАН ДЛЯ УЧАСТИЯ",
      ticket: "ВАШ БИЛЕТ",
      note: "@aifinik_kg",
    }
    : {
      // Без вшитого TTF стандартные PDF шрифты ломают кириллицу.
      title: "WIN A TRIP TO TASHKENT!",
      scan: "SCAN TO ENTER",
      ticket: "YOUR TICKET",
      note: "@aifinik_kg",
    };

  // ===== 3) ЗАГОЛОВКИ =====
  doc.font(font).fontSize(9.2).fillColor("#FFE7A6").text(
    text.title,
    x + PAD,
    y + 4.2,
    { width: CARD_W - PAD * 2, align: "center" }
  );

  doc.font(font).fontSize(8.4).fillColor("#FFFFFF").text(
    "AIFINIK",
    x + PAD,
    y + 13.4,
    { width: CARD_W - PAD * 2, align: "center" }
  );

  // ===== 4) QR-БЛОК =====
  const qrBoxW = 22.5 * MM_TO_PT;
  const qrBoxH = 24 * MM_TO_PT;
  const qrBoxX = x + CARD_W / 2 - qrBoxW / 2;
  const qrBoxY = y + 30;
  const qrTopLabelH = 9;
  const qrBottomLabelH = 8;
  const qrInnerPad = 3;

  // тень
  doc.roundedRect(qrBoxX + 1.2, qrBoxY + 1.2, qrBoxW, qrBoxH, 6)
    .fillOpacity(0.22).fill("#000").fillOpacity(1);

  // белая карточка + тонкая рамка
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 6).fill("#FFFFFF");
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 6)
    .lineWidth(0.5)
    .strokeOpacity(0.35)
    .stroke("#111827")
    .strokeOpacity(1);

  // подпись над QR
  doc.font(font).fontSize(5.6).fillColor("#111827").text(
    text.scan,
    qrBoxX,
    qrBoxY + 2.3,
    { width: qrBoxW, align: "center" }
  );

  // QR (делаем крупно и чётко)
  const qrValue = buildEntryUrl(token);
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    margin: 0,
    errorCorrectionLevel: "M",
    width: 800,
  });

  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");

  const qrZoneY = qrBoxY + qrTopLabelH + qrInnerPad;
  const qrZoneH = qrBoxH - qrTopLabelH - qrBottomLabelH - qrInnerPad * 2;
  const qrSize = Math.min(qrBoxW - qrInnerPad * 2 - 2, qrZoneH);
  const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrY = qrZoneY + (qrZoneH - qrSize) / 2;

  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // подпись под QR
  doc.font(font).fontSize(5.0).fillColor("#111827").text(
    text.ticket,
    qrBoxX,
    qrBoxY + qrBoxH - qrBottomLabelH + 1,
    { width: qrBoxW, align: "center" }
  );

  // ===== 5) КОД снизу =====
  doc.font(font).fontSize(10.8).fillColor("#FFFFFF").text(
    token,
    x + PAD,
    y + CARD_H - 14.8,
    { width: CARD_W - PAD * 2, align: "center" }
  );

  // микро-условия
  doc.font(font).fontSize(4.4).fillColor("#E5E7EB").fillOpacity(0.96).text(
    text.note,
    x + PAD,
    y + CARD_H - 6.0,
    { width: CARD_W - PAD * 2, align: "center" }
  ).fillOpacity(1);
}
