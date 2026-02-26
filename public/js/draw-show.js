const token = localStorage.getItem("aifinik_admin_token") || "";
if (!token) location.href = "/admin/login.html";

const reel = document.getElementById("reel");
const drawSelect = document.getElementById("drawSelect");
const durationInput = document.getElementById("duration");
const soundMode = document.getElementById("soundMode");
const btnGo = document.getElementById("btnGo");
const btnFS = document.getElementById("btnFS");
const btnNext = document.getElementById("btnNext");
const btnResults = document.getElementById("btnResults");
const msg = document.getElementById("msg");

const reveal = document.getElementById("reveal");
const placeEl = document.getElementById("place");
const ticketEl = document.getElementById("ticket");
const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const codeEl = document.getElementById("code");
const hashEl = document.getElementById("hash");

const flash = document.getElementById("flash");
const panel = document.getElementById("panel");

const boardRows = document.getElementById("boardRows");

// ------------------ STATE ------------------
let winnersQueue = [];       // показываем по одному (place desc)
let revealed = [];           // уже показанные
let auditHash = "";
let totalParticipants = 0;
let drawInfo = null;
let running = false;

// ---------- API ----------
async function apiGet(path){
  const res = await fetch(path, { headers: { Authorization:`Bearer ${token}` }});
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) throw new Error(data.message || "API error");
  return data;
}
async function apiPost(path, body){
  const res = await fetch(path, {
    method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.ok) throw new Error(data.message || "API error");
  return data;
}

// ---------- SOUND (WebAudio) ----------
let audioCtx = null;
function ensureAudio(){
  if(soundMode.value === "off") return null;
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function clickBeep(){
  const ctx = ensureAudio(); if(!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = 650;
  g.gain.value = 0.02;
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.03);
}
function drumroll(){
  const ctx = ensureAudio(); if(!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.value = 120;
  g.gain.value = 0.0;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  const start = ctx.currentTime;
  const dur = 1.0;
  const i = setInterval(()=>{
    const t = ctx.currentTime - start;
    if(t > dur){
      clearInterval(i);
      g.gain.setValueAtTime(0.0, ctx.currentTime);
      o.stop(ctx.currentTime + 0.05);
      return;
    }
    g.gain.setValueAtTime(0.02 + Math.random()*0.03, ctx.currentTime);
    o.frequency.setValueAtTime(110 + Math.random()*70, ctx.currentTime);
  }, 35);
}
function winChord(){
  const ctx = ensureAudio(); if(!ctx) return;
  const freqs = [392, 523.25, 659.25];
  const now = ctx.currentTime;
  freqs.forEach((f, idx)=>{
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.value = 0.0;
    o.connect(g); g.connect(ctx.destination);
    o.start(now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.05);
    g.gain.linearRampToValueAtTime(0.0, now + 0.5 + idx*0.05);
    o.stop(now + 0.7);
  });
}

// ---------- CONFETTI ----------
const canvas = document.getElementById("confetti");
const ctx2d = canvas.getContext("2d");
let confetti = [];
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener("resize", resize); resize();

function fireConfetti(power = 1){
  confetti = [];
  const N = Math.floor(240 * power);
  for(let i=0;i<N;i++){
    confetti.push({
      x: canvas.width/2,
      y: canvas.height/2 - 60,
      vx: (Math.random()-0.5)*14*power,
      vy: (Math.random()-0.9)*18*power,
      g: 0.35 + Math.random()*0.18,
      r: 4 + Math.random()*6,
      a: 1
    });
  }
  let t0 = performance.now();
  (function anim(t){
    t0 = t;
    ctx2d.clearRect(0,0,canvas.width,canvas.height);
    confetti.forEach(p=>{
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.a *= 0.992;
      ctx2d.globalAlpha = p.a;
      ctx2d.beginPath();
      ctx2d.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx2d.fillStyle = ["#22d3ee","#0ea5e9","#a78bfa","#34d399","#fbbf24"][Math.floor(Math.random()*5)];
      ctx2d.fill();
    });
    ctx2d.globalAlpha = 1;
    confetti = confetti.filter(p => p.a > 0.08 && p.y < canvas.height + 40);
    if(confetti.length) requestAnimationFrame(anim);
  })(performance.now());
}

function flashBang(){
  flash.style.opacity = "0.9";
  setTimeout(()=> flash.style.opacity = "0", 120);
}

// ---------- REEL / ANIMATION ----------
function easeOutQuint(t){ return 1 - Math.pow(1 - t, 5); }

function buildReel(finalTicket){
  const items = [];
  for(let i=0;i<210;i++){
    const n = Math.floor(Math.random()*9000)+1000;
    items.push(`#${String(n).padStart(4,"0")}`);
  }
  items.push(finalTicket);
  return items;
}

function render(items){
  reel.innerHTML = items.map(x => `<div class="item">${x}</div>`).join("");
}

async function spinTo(finalTicket, seconds){
  reveal.style.display = "none";

  const items = buildReel(finalTicket);
  render(items);

  const itemH = 56;
  const focusCenter = 105;
  const winnerIndex = items.length - 1;
  const targetY = focusCenter - (winnerIndex * itemH + itemH/2);

  const startY = 40;
  reel.style.transform = `translateY(${startY}px)`;

  const start = performance.now();
  const dur = seconds * 1000;

  let lastTick = 0;

  return new Promise(resolve => {
    function frame(now){
      const t = Math.min(1, (now - start) / dur);
      const e = easeOutQuint(t);

      const overshoot = -28;
      const y = startY + (targetY + overshoot - startY) * e;
      reel.style.transform = `translateY(${y}px)`;

      const tickEvery = 60 + (t*220);
      if(now - lastTick > tickEvery){
        clickBeep();
        lastTick = now;
      }

      if(t < 1) return requestAnimationFrame(frame);

      drumroll();

      reel.style.transition = "transform 420ms cubic-bezier(.18,.89,.32,1.15)";
      reel.style.transform = `translateY(${targetY}px)`;

      setTimeout(()=>{
        reel.style.transition = "";
        resolve();
      }, 520);
    }
    requestAnimationFrame(frame);
  });
}

// ---------- UI HELPERS ----------
btnFS.addEventListener("click", async ()=>{
  if(!document.fullscreenElement){
    await document.documentElement.requestFullscreen?.();
  }else{
    await document.exitFullscreen?.();
  }
});

function setReveal(w){
  const isGrand = w.place === 1;

  placeEl.textContent = isGrand
    ? "🏆 1 место (Главный приз)"
    : `🎁 ${w.place} место`;

  ticketEl.textContent = w.ticketDisplay || "#----";
  nameEl.textContent = w.fullName || "";
  phoneEl.textContent = w.phoneE164 || "";
  codeEl.textContent = w.codeToken || "";
  hashEl.textContent = auditHash || "";

  reveal.style.display = "block";
}

function addToBoard(w){
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "90px 1fr";
  row.style.gap = "10px";
  row.style.padding = "10px";
  row.style.borderRadius = "14px";
  row.style.border = "1px solid rgba(255,255,255,.10)";
  row.style.background = "rgba(255,255,255,.04)";

  const left = document.createElement("div");
  left.style.fontFamily = "ui-monospace,Consolas,monospace";
  left.style.fontWeight = "1000";
  left.style.fontSize = "18px";
  left.textContent = w.place === 1 ? "1 🏆" : `${w.place}`;

  const right = document.createElement("div");
  right.innerHTML = `<div style="font-weight:900">${w.ticketDisplay}</div>
                     <div style="opacity:.75;font-size:12px">${w.fullName || ""}</div>`;

  row.appendChild(left);
  row.appendChild(right);

  // сверху показываем важнее: 1 место вверху
  boardRows.prepend(row);
}

function setButtons(){
  btnNext.disabled = running || winnersQueue.length === 0;
  btnResults.disabled = running || revealed.length === 0 || winnersQueue.length !== 0;
}

function resetSession(){
  winnersQueue = [];
  revealed = [];
  auditHash = "";
  totalParticipants = 0;
  drawInfo = null;
  boardRows.innerHTML = "";
  reveal.style.display = "none";
  msg.textContent = "";
  setButtons();
}

// ---------- LOAD DRAWS ----------
async function loadDraws(){
  const data = await apiGet("/api/admin/draws");
  drawSelect.innerHTML = "";
  const items = data.items || [];
  if(!items.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Нет розыгрышей — создай в панели";
    drawSelect.appendChild(opt);
    drawSelect.disabled = true;
    btnGo.disabled = true;
    return;
  }
  items.forEach(d=>{
    const opt = document.createElement("option");
    opt.value = d._id || d.id;
    const when = d.drawAt ? new Date(d.drawAt).toLocaleString() : "";
    opt.textContent = `${d.name} — ${when} — призов: ${d.prizesCount || 1}`;
    drawSelect.appendChild(opt);
  });
}

// ---------- FLOW ----------
btnGo.addEventListener("click", async ()=>{
  resetSession();
  btnGo.disabled = true;

  try{
    ensureAudio();
    const id = drawSelect.value;
    if(!id) throw new Error("Выбери розыгрыш");

    msg.textContent = "Сервер выбирает победителей…";
    const data = await apiPost(`/api/admin/draws/${id}/run`, {});

    drawInfo = data.draw || null;
    totalParticipants = data.totalParticipants || 0;
    auditHash = data.audit?.randomHash || "";

    // сортируем так, чтобы показывать "с конца" и финал 1 место
    const winners = (data.winners || []).slice().sort((a,b)=> b.place - a.place);
    if(!winners.length) throw new Error("Победители не найдены");

    winnersQueue = winners;
    msg.textContent = `Готово. Участников: ${totalParticipants}. Жми NEXT PRIZE.`;
    setButtons();
  }catch(e){
    msg.textContent = "Ошибка: " + e.message;
  }finally{
    btnGo.disabled = false;
  }
});

btnNext.addEventListener("click", async ()=>{
  if (running) return;
  const next = winnersQueue.shift();
  if (!next) return setButtons();

  running = true;
  setButtons();

  try{
    const seconds = Math.max(5, Math.min(18, Number(durationInput.value || 8)));
    const isGrand = next.place === 1;

    msg.textContent = isGrand
      ? "Финал… главный приз!"
      : `Разыгрываем ${next.place} место…`;

    await spinTo(next.ticketDisplay, seconds);

    flashBang();
    fireConfetti(isGrand ? 1.2 : 0.7);
    winChord();
    panel.classList.add("shake");
    setTimeout(()=>panel.classList.remove("shake"), 450);

    setReveal(next);
    revealed.push(next);
    addToBoard(next);

    msg.textContent = winnersQueue.length
      ? "Жми NEXT PRIZE для следующего приза."
      : "Все призы разыграны. Жми RESULTS ✅";
  }catch(e){
    msg.textContent = "Ошибка: " + e.message;
  }finally{
    running = false;
    setButtons();
  }
});

btnResults.addEventListener("click", async ()=>{
  if (running) return;
  if (winnersQueue.length !== 0) {
    msg.textContent = "Сначала дорозыграй все призы кнопкой NEXT PRIZE.";
    return;
  }

  // Итоговый экран: просто подсветим и выведем текст
  running = true;
  setButtons();

  try{
    flashBang();
    fireConfetti(1.3);
    winChord();

    // делаем общий итог в сообщении (без таблиц/попапов)
    const ordered = revealed.slice().sort((a,b)=> a.place - b.place); // 1..N
    const lines = ordered.map(w => `${w.place} место — ${w.ticketDisplay} — ${w.fullName || ""}`);
    msg.textContent = `ИТОГ: ${lines.join(" | ")} `;
  } finally {
    running = false;
    setButtons();
  }
});

// если поменяли draw — сбрасываем
drawSelect.addEventListener("change", resetSession);

resetSession();
loadDraws().catch(e => msg.textContent = "Ошибка загрузки розыгрышей: " + e.message);
console.log("🎬 Ready to draw!");