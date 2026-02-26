const form = document.getElementById("promoForm");

const stepForm = document.getElementById("stepForm");
const stepSuccess = document.getElementById("stepSuccess");

const fullNameInput = document.getElementById("fullName");
const phoneInput = document.getElementById("phone");
const codeInput = document.getElementById("code");

const formError = document.getElementById("formError");

const btnSubmit = document.getElementById("btnSubmit");
const btnText = btnSubmit.querySelector(".btnText");
const btnSpinner = btnSubmit.querySelector(".btnSpinner");

const ticketNumberEl = document.getElementById("ticketNumber");
const ticketNameEl = document.getElementById("ticketName");
const ticketPhoneEl = document.getElementById("ticketPhone");
const ticketCodeEl = document.getElementById("ticketCode");
const msgRuEl = document.getElementById("msgRu");
const msgKgEl = document.getElementById("msgKg");

const btnCopy = document.getElementById("btnCopy");
const btnAgain = document.getElementById("btnAgain");
const copyToast = document.getElementById("copyToast");

const btnRestoreOpen = document.getElementById("btnRestoreOpen");
const restoreBox = document.getElementById("restoreBox");
const restorePhone = document.getElementById("restorePhone");
const btnRestore = document.getElementById("btnRestore");
const restoreError = document.getElementById("restoreError");

function showRestoreError(msg) {
  restoreError.textContent = msg || "Ошибка";
  restoreError.classList.remove("hidden");
}
function clearRestoreError() {
  restoreError.textContent = "";
  restoreError.classList.add("hidden");
}

btnRestoreOpen?.addEventListener("click", () => {
  clearRestoreError();
  restoreBox.classList.toggle("hidden");
  if (!restoreBox.classList.contains("hidden")) restorePhone.focus();
});

btnRestore?.addEventListener("click", async () => {
  clearRestoreError();
  const phone = (restorePhone.value || "").trim();
  if (phone.length < 6) return showRestoreError("Введите номер телефона.");

  try {
    const res = await fetch("/api/public/ticket-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Билет не найден");
    }

    // показать карточку
    const payload = {
      fullName: data.fullName || "",
      phone: data.phoneE164 || phone,
      code: data.codeToken || "",
    };

    showSuccess(data, payload);

    // сохранить в localStorage
    localStorage.setItem(
      "aifinik_ticket",
      JSON.stringify({
        ticketNumber: data.ticketNumber,
        ticketDisplay: data.ticketDisplay,
        fullName: payload.fullName,
        phone: payload.phone,
        code: (payload.code || "").toUpperCase(),
        savedAt: Date.now(),
      }),
    );
  } catch (err) {
    showRestoreError(err.message);
  }
});

const cdValue = document.getElementById("cdValue");
let drawAtISO = null;
let cdTimer = null;

async function loadConfig() {
  try {
    const res = await fetch("/api/public/config");
    const data = await res.json();
    if (data.ok && data.drawAt) drawAtISO = data.drawAt;
  } catch {}
}

function startCountdown() {
  if (!cdValue) return;
  if (!drawAtISO) {
    cdValue.textContent = "Дата розыгрыша скоро";
    return;
  }

  const drawAt = new Date(drawAtISO).getTime();

  const tick = () => {
    const now = Date.now();
    let diff = drawAt - now;

    if (diff <= 0) {
      cdValue.textContent = "Розыгрыш уже начался";
      clearInterval(cdTimer);
      return;
    }

    const s = Math.floor(diff / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;

    cdValue.textContent = `${days}д ${hours}ч ${mins}м ${secs}с`;
  };

  tick();
  cdTimer = setInterval(tick, 1000);
}

// автоподстановка кода из QR: enter.html?c=XXXX-XXXX
const params = new URLSearchParams(window.location.search);
const codeFromQR = params.get("c");

function tryLoadSavedTicket() {
  const raw = localStorage.getItem("aifinik_ticket");
  if (!raw) return false;

  try {
    const t = JSON.parse(raw);
    if (!t.ticketNumber || !t.phone) return false;

    // имитируем payload и data, чтобы использовать showSuccess
    const payload = {
      fullName: t.fullName || "",
      phone: t.phone,
      code: t.code || "",
    };
    const data = {
      ok: true,
      ticketNumber: t.ticketNumber,
      ticketDisplay:
        t.ticketDisplay || `#${String(t.ticketNumber).padStart(4, "0")}`,
      ru: `✅ Регистрация принята (Aifinik). Ваш билет: ${t.ticketDisplay || ""}`,
      kg: `✅ Каттоо кабыл алынды (Aifinik). Сиздин билет: ${t.ticketDisplay || ""}`,
    };

    showSuccess(data, payload);
    return true;
  } catch {
    return false;
  }
}

tryLoadSavedTicket();

if (codeFromQR) codeInput.value = String(codeFromQR).toUpperCase();

function setLoading(isLoading) {
  if (isLoading) {
    btnSubmit.disabled = true;
    btnText.textContent = "Обработка...";
    btnSpinner.classList.remove("hidden");
  } else {
    btnSubmit.disabled = false;
    btnText.textContent = "Получить билет";
    btnSpinner.classList.add("hidden");
  }
}

function showError(message) {
  formError.textContent = message || "Ошибка";
  formError.classList.remove("hidden");
}

function clearError() {
  formError.textContent = "";
  formError.classList.add("hidden");
}

function showSuccess(data, payload) {
  // переключаем экран
  stepForm.classList.add("hidden");
  stepSuccess.classList.remove("hidden");

  // заполняем билет
  ticketNumberEl.textContent =
    data.ticketDisplay ||
    `#${String(data.ticketNumber || "").padStart(4, "0")}`;
  ticketNameEl.textContent = payload.fullName;
  ticketPhoneEl.textContent = payload.phone;
  ticketCodeEl.textContent = payload.code.toUpperCase();

  msgRuEl.textContent = data.ru || "";
  msgKgEl.textContent = data.kg || "";

  // запоминаем для копирования
  stepSuccess.dataset.copy = [
    "Aifinik ✅",
    `Билет: ${ticketNumberEl.textContent}`,
    `ФИО: ${payload.fullName}`,
    `Телефон: ${payload.phone}`,
    `Код: ${payload.code.toUpperCase()}`,
    "",
    data.ru || "",
    data.kg || "",
  ]
    .filter(Boolean)
    .join("\n");

  localStorage.setItem(
    "aifinik_ticket",
    JSON.stringify({
      ticketNumber: data.ticketNumber,
      ticketDisplay: data.ticketDisplay,
      fullName: payload.fullName,
      phone: payload.phone,
      code: payload.code.toUpperCase(),
      savedAt: Date.now(),
    }),
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function toast() {
  copyToast.classList.remove("hidden");
  setTimeout(() => copyToast.classList.add("hidden"), 1200);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const payload = {
    fullName: fullNameInput.value.trim(),
    phone: phoneInput.value.trim(),
    code: codeInput.value.trim(),
  };

  if (!payload.fullName || payload.fullName.length < 2)
    return showError("Введите ФИО.");
  if (!payload.phone || payload.phone.length < 6)
    return showError("Введите номер телефона.");
  if (!payload.code || payload.code.length < 4)
    return showError("Введите код.");

  setLoading(true);

  try {
    const res = await fetch("/api/public/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Ошибка регистрации");
    }

    showSuccess(data, payload);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

btnCopy.addEventListener("click", async () => {
  const text = stepSuccess.dataset.copy || "";
  if (!text) return;

  const ok = await copyText(text);
  if (ok) toast();
});

btnAgain.addEventListener("click", () => {
  // reset UI
  stepSuccess.classList.add("hidden");
  stepForm.classList.remove("hidden");
  clearError();

  // очистим поля, но код можно оставить если пришли по QR
  fullNameInput.value = "";
  phoneInput.value = "";
  if (!codeFromQR) codeInput.value = "";

  // убрать ?c=... из адреса (чтобы не путаться)
  if (window.history && window.history.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.delete("c");
    window.history.replaceState({}, "", url.pathname);
  }
});
loadConfig().then(startCountdown);
