const video = document.getElementById("video");
const stage = document.getElementById("stage");
const stickersDiv = document.getElementById("stickers");

let stream = null;
let facing = "user";

/* ---------------- KAMERA ---------------- */
async function startCamera(){
  if(stream) stream.getTracks().forEach(t=>t.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video:{ facingMode:facing }
  });

  video.srcObject = stream;
  video.style.transform = facing==="user" ? "scaleX(-1)" : "none";
}

document.getElementById("flip").onclick = ()=>{
  facing = facing==="user" ? "environment" : "user";
  startCamera();
};

startCamera();

/* ---------------- IZBIRA / BRISANJE ---------------- */
let selectedSticker = null;

function selectSticker(el){
  document.querySelectorAll(".sticker").forEach(s => s.classList.remove("selected"));
  selectedSticker = el;
  if(el) el.classList.add("selected");
}

document.getElementById("deleteSelected").onclick = ()=>{
  if(selectedSticker){
    selectedSticker.remove();
    selectedSticker = null;
  }
};

document.getElementById("clearAll").onclick = ()=>{
  stickersDiv.innerHTML = "";
  selectedSticker = null;
};

// tap na prazno -> odznači
stage.addEventListener("click", (e)=>{
  if(!e.target.classList.contains("sticker")){
    selectSticker(null);
  }
});

/* ---------------- NALepke + PINCH (TOUCH) ---------------- */
document.querySelectorAll(".emojis button").forEach(btn=>{
  btn.onclick = ()=>{
    const el = document.createElement("div");
    el.className = "sticker";
    el.textContent = btn.textContent;

    // stanje (v % + transform)
    el.dataset.x = "50";
    el.dataset.y = "50";
    el.dataset.s = "1";
    el.dataset.r = "0";

    applyTransform(el);

    // select on tap
    el.addEventListener("click", (e)=>{
      e.stopPropagation();
      selectSticker(el);
    });

    enableTouchGestures(el);

    stickersDiv.appendChild(el);
    selectSticker(el);
  };
});

function applyTransform(el){
  const x = Number(el.dataset.x);
  const y = Number(el.dataset.y);
  const s = Number(el.dataset.s);
  const r = Number(el.dataset.r);

  el.style.left = x + "%";
  el.style.top  = y + "%";
  el.style.transform = `translate(-50%,-50%) rotate(${r}deg) scale(${s})`;
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function enableTouchGestures(el){
  let dragging = false;
  let dragOffset = null;

  // pinch start
  let startDist = 0;
  let startAngle = 0;
  let startScale = 1;
  let startRot = 0;
  let lastMid = null;

  function rect(){ return stage.getBoundingClientRect(); }

  function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
  function angle(a,b){ return Math.atan2(b.y-a.y, b.x-a.x); }
  function mid(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

  function pts(touches){
    return Array.from(touches).map(t => ({ x:t.clientX, y:t.clientY }));
  }

  el.addEventListener("touchstart", (ev)=>{
    // pomembno: samo ko se dotikaš nalepke
    ev.stopPropagation();
    selectSticker(el);

    const r = rect();
    const t = ev.touches;

    if(t.length === 1){
      // 1 prst: začni drag (tu preventDefault, ker premikamo nalepko)
      ev.preventDefault();
      dragging = true;

      const p = t[0];
      const ex = p.clientX - r.left;
      const ey = p.clientY - r.top;

      const curX = (Number(el.dataset.x)/100) * r.width;
      const curY = (Number(el.dataset.y)/100) * r.height;

      dragOffset = { dx: ex - curX, dy: ey - curY };
      return;
    }

    if(t.length === 2){
      // 2 prsta: pinch (preventDefault da ne zooma stran)
      ev.preventDefault();
      dragging = false;
      dragOffset = null;

      const [p1,p2] = pts(t);
      startDist = dist(p1,p2);
      startAngle = angle(p1,p2);
      startScale = Number(el.dataset.s);
      startRot = Number(el.dataset.r);
      lastMid = mid(p1,p2);
    }
  }, { passive:false });

  el.addEventListener("touchmove", (ev)=>{
    ev.stopPropagation();
    const r = rect();
    const t = ev.touches;

    // 1 prst drag
    if(t.length === 1 && dragging && dragOffset){
      ev.preventDefault();
      const p = t[0];

      const ex = p.clientX - r.left;
      const ey = p.clientY - r.top;

      let px = ex - dragOffset.dx;
      let py = ey - dragOffset.dy;

      let x = (px / r.width) * 100;
      let y = (py / r.height) * 100;

      x = clamp(x, 2, 98);
      y = clamp(y, 2, 98);

      el.dataset.x = String(x);
      el.dataset.y = String(y);
      applyTransform(el);
      return;
    }

    // 2 prsta pinch + rotate + move
    if(t.length === 2){
      ev.preventDefault();

      const [p1,p2] = pts(t);
      const d = dist(p1,p2);
      const a = angle(p1,p2);
      const m = mid(p1,p2);

      // scale
      let ns = startScale * (d / startDist);
      ns = clamp(ns, 0.4, 3.0);

      // rotation
      const delta = a - startAngle;
      const nr = startRot + (delta * 180 / Math.PI);

      // premik z midpointom
      if(lastMid){
        const dx = m.x - lastMid.x;
        const dy = m.y - lastMid.y;

        const curXpx = (Number(el.dataset.x)/100) * r.width;
        const curYpx = (Number(el.dataset.y)/100) * r.height;

        const nxpx = curXpx + dx;
        const nypx = curYpx + dy;

        let x = (nxpx / r.width) * 100;
        let y = (nypx / r.height) * 100;

        x = clamp(x, 2, 98);
        y = clamp(y, 2, 98);

        el.dataset.x = String(x);
        el.dataset.y = String(y);
        lastMid = m;
      }

      el.dataset.s = String(ns);
      el.dataset.r = String(nr);
      applyTransform(el);
    }
  }, { passive:false });

  el.addEventListener("touchend", (ev)=>{
    // reset
    dragging = false;
    dragOffset = null;
    if(ev.touches.length < 2) lastMid = null;
  });
}

/* ---------------- FOTOGRAFIRANJE ---------------- */
document.getElementById("shot").onclick = async ()=>{
  const W=1080, H=1920;
  const canvas = document.createElement("canvas");
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext("2d");

  /* video crop */
  const vw=video.videoWidth, vh=video.videoHeight;
  const tr=W/H, vr=vw/vh;
  let sx=0,sy=0,sw=vw,sh=vh;
  if(vr>tr){ sw=vh*tr; sx=(vw-sw)/2; }
  else{ sh=vw/tr; sy=(vh-sh)/2; }

  if(facing==="user"){
    ctx.translate(W,0); ctx.scale(-1,1);
  }
  ctx.drawImage(video,sx,sy,sw,sh,0,0,W,H);
  ctx.setTransform(1,0,0,1,0,0);

  /* overlay */
  const overlay = document.querySelector(".overlay");
  const ow=overlay.naturalWidth, oh=overlay.naturalHeight;
  const sc=Math.min(W/ow,H/oh);
  ctx.drawImage(overlay,(W-ow*sc)/2,(H-oh*sc)/2,ow*sc,oh*sc);

  /* nalepke (upoštevaj scale+rot) */
  document.querySelectorAll(".sticker").forEach(el=>{
    const xPct = Number(el.dataset.x);
    const yPct = Number(el.dataset.y);
    const s = Number(el.dataset.s);
    const r = Number(el.dataset.r);

    const x = (xPct/100) * W;
    const y = (yPct/100) * H;

    const base = 80;
    const fontPx = base * s;

    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(r * Math.PI / 180);

    ctx.font = `${fontPx}px system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji"`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(el.textContent,0,0);
    ctx.restore();
  });

  const url = canvas.toDataURL("image/png");

  /* ⬇️ SAMODEJNI PRENOS / iOS fallback */
  const a=document.createElement("a");
  a.href=url;
  a.download="fotofilter.png";
  a.target="_blank";
  a.click();
};
