const token = localStorage.getItem("aifinik_admin_token") || "";
if (!token) location.href = "/admin/login.html";

const rows = document.getElementById("rows");
const out = document.getElementById("out");

function show(msg){
  out.textContent = msg;
  out.classList.remove("hidden");
}
function hide(){ out.classList.add("hidden"); }

async function load(){
  hide();
  rows.innerHTML = "";
  try{
    const res = await fetch("/api/admin/participants?limit=500", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok) throw new Error(data.message || "Load error");

    for(const p of data.items){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(p.createdAt).toLocaleString()}</td>
        <td class="mono">${p.ticketDisplay || ""}</td>
        <td>${p.fullName || ""}</td>
        <td class="mono">${p.phoneE164 || ""}</td>
        <td class="mono">${p.codeToken || ""}</td>
      `;
      rows.appendChild(tr);
    }
    show(`✅ Загружено: ${data.items.length}`);
  }catch(e){
    show("❌ " + e.message);
  }
}

document.getElementById("btnReload").addEventListener("click", load);
load();