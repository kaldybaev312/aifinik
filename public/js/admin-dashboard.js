const out = document.getElementById("out");
const token = localStorage.getItem("aifinik_admin_token") || "";

if (!token) location.href = "/admin/login.html";

function show(msg){
  out.textContent = msg;
  out.classList.remove("hidden");
}
function hide(){ out.classList.add("hidden"); }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "API error");
  return data;
}

document.getElementById("btnLogout").addEventListener("click", () => {
  localStorage.removeItem("aifinik_admin_token");
  location.href = "/admin/login.html";
});

document.getElementById("btnGen").addEventListener("click", async () => {
  hide();
  try{
    const count = Number(document.getElementById("count").value || 0);
    const data = await api("/api/admin/codes/generate", {
      method:"POST",
      body: JSON.stringify({ count })
    });
    show(`✅ Сгенерировано: ${data.inserted}`);
  }catch(e){ show("❌ " + e.message); }
});

document.getElementById("btnCSV").addEventListener("click", () => {
  downloadWithAuth("/api/admin/codes/export.csv?status=ACTIVE", "aifinik_codes_ACTIVE.csv");
});

document.getElementById("btnPDF").addEventListener("click", () => {
  downloadWithAuth("/api/admin/print/cards.pdf?status=ACTIVE&limit=200", "aifinik_cards_200.pdf");
});

document.getElementById("btnOpenShow").addEventListener("click", () => {
  window.location.href = "../draw-show.html";
});

async function downloadWithAuth(url, filename){
  hide();
  try{
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if(!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Download failed");
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    const blobUrl = URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    show(`✅ Скачано: ${filename}`);
  }catch(e){ show("❌ " + e.message); }
}

// CREATE DRAW (без seed)
document.getElementById("btnCreateDraw").addEventListener("click", async () => {
  hide();
  try{
    const name = document.getElementById("drawName").value.trim();
    const dtLocal = document.getElementById("drawAt").value; // "YYYY-MM-DDTHH:mm"
    const prizesCount = Number(document.getElementById("prizesCount").value || 1);

    if(!dtLocal) throw new Error("Укажи дату и время розыгрыша.");

    // Превращаем в ISO (браузер возьмёт локальную TZ)
    const drawAtISO = new Date(dtLocal).toISOString();

    const data = await api("/api/admin/draws", {
      method:"POST",
      body: JSON.stringify({ name, drawAtISO, prizesCount })
    });

    show(`✅ Розыгрыш создан: ${data.name} | призов: ${data.prizesCount}`);
  }catch(e){
    show("❌ " + e.message);
  }
});
