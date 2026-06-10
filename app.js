/* Guardaroba di Mia — logica app (vanilla JS, nessuna dipendenza) */

const CATEGORIE = [
  "Magliette / T-shirt", "Camicie / Bluse", "Maglioni / Felpe",
  "Pantaloni / Jeans", "Gonne", "Vestiti / Abiti", "Giacche / Cappotti",
  "Scarpe", "Borse", "Accessori", "Intimo", "Sport", "Altro"
];
const STAGIONI = ["Tutto l'anno", "Primavera", "Estate", "Autunno", "Inverno"];

/* ---------- IndexedDB (storage locale) ---------- */
const DB_NAME = "guardaroba-mia";
const STORE = "capi";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
function putCapo(c) {
  return new Promise((res, rej) => { const r = tx("readwrite").put(c); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
function delCapo(id) {
  return new Promise((res, rej) => { const r = tx("readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
function getAll() {
  return new Promise((res, rej) => { const r = tx("readonly").getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
}

/* ---------- Stato ---------- */
let capi = [];                 // tutti i capi in memoria
let codaIndex = 0;             // posizione corrente nella coda
const uid = () => Date.now().toString(36) + Math.floor(performance.now() % 1e6).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Utilità immagini ---------- */
// Ridimensiona e comprime in JPEG base64 (max lato 1024px)
function resizeImage(file, maxSide = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxSide) { height = Math.round(height * maxSide / width); width = maxSide; }
      else if (height > maxSide) { width = Math.round(width * maxSide / height); height = maxSide; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Versione compatta SOLO per l'AI (meno pixel = molti meno token = meno costo).
// 512px bastano per riconoscere il capo; la foto a piena risoluzione resta salvata.
function base64PerAI(dataUrl, maxSide = 512, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSide) { height = Math.round(height * maxSide / width); width = maxSide; }
      else if (height > maxSide) { width = Math.round(width * maxSide / height); height = maxSide; }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* ---------- Navigazione ---------- */
function showView(name) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  if (name === "coda") renderCoda();
  if (name === "guardaroba") renderGuardaroba();
}
$$(".tab").forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));

/* ---------- Import foto (bulk) ---------- */
$("#file-input").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    try {
      const dataUrl = await resizeImage(file);
      const capo = {
        id: uid(), img: dataUrl, stato: "bozza",
        categoria: "", tipo: "", colore: "", stagione: "", materiale: "", note: "", tags: [],
        creato: new Date().toISOString()
      };
      await putCapo(capo);
      capi.push(capo);
      added++;
    } catch (err) { console.error("Errore foto:", err); }
  }
  e.target.value = "";
  updateCounter();
  codaIndex = 0;
  toast(`${added} foto aggiunte ✨`);
  showView("coda");
});

/* ---------- Coda: cataloga uno a uno ---------- */
function bozze() { return capi.filter(c => c.stato === "bozza"); }

function renderCoda() {
  const lista = bozze();
  const vuota = $("#coda-vuota"), card = $("#coda-card");
  if (!lista.length) { vuota.hidden = false; card.hidden = true; return; }
  vuota.hidden = true; card.hidden = false;
  if (codaIndex >= lista.length) codaIndex = 0;
  const capo = lista[codaIndex];
  card.dataset.id = capo.id;
  $("#coda-img").src = capo.img;
  $("#coda-progress").textContent = `${codaIndex + 1} / ${lista.length}`;
  // popola form con eventuali valori già presenti
  $("#f-categoria").value = capo.categoria || "";
  $("#f-tipo").value = capo.tipo || "";
  $("#f-colore").value = capo.colore || "";
  $("#f-stagione").value = capo.stagione || STAGIONI[0];
  $("#f-materiale").value = capo.materiale || "";
  $("#f-note").value = capo.note || "";
  $("#f-tags").value = (capo.tags || []).join(", ");

  // Analisi automatica: parte da sola se c'è la chiave e non è già stata fatta
  const key = localStorage.getItem("apikey");
  if (key && !capo.aiDone) {
    runAI(capo);
  } else if (!key) {
    setAiStatus("Imposta la chiave AI in ⚙️ per la compilazione automatica.", "");
  } else {
    setAiStatus("✅ Già analizzato — controlla e salva.", "");
  }
}

function setAiStatus(text, cls) {
  const el = $("#ai-status");
  el.textContent = text;
  el.className = "ai-status" + (cls ? " " + cls : "");
}

function currentCapo() {
  const id = $("#coda-card").dataset.id;
  return capi.find(c => c.id === id);
}

// Copia i valori del form dentro il capo (senza cambiarne lo stato)
function leggiFormNelCapo(capo) {
  capo.categoria = $("#f-categoria").value;
  capo.tipo = $("#f-tipo").value.trim();
  capo.colore = $("#f-colore").value.trim();
  capo.stagione = $("#f-stagione").value;
  capo.materiale = $("#f-materiale").value.trim();
  capo.note = $("#f-note").value.trim();
  capo.tags = $("#f-tags").value.split(",").map(t => t.trim()).filter(Boolean);
}

$("#coda-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const capo = currentCapo(); if (!capo) return;
  leggiFormNelCapo(capo);
  capo.stato = "catalogato";
  capo.aggiornato = new Date().toISOString();
  await putCapo(capo);
  updateCounter();
  buzz();
  toast("Salvato ✓");
  renderCoda();
});

// "Salta": non perde le modifiche manuali, le salva nella bozza
$("#btn-skip").addEventListener("click", async () => {
  const capo = currentCapo();
  if (capo) { leggiFormNelCapo(capo); await putCapo(capo); }
  codaIndex++;
  renderCoda();
});

$("#btn-elimina").addEventListener("click", () => {
  const capo = currentCapo(); if (!capo) return;
  eliminaCapo(capo, renderCoda);
});

/* ---------- AI: riconoscimento capo ---------- */
// Bottone "Ri-analizza": forza una nuova analisi sul capo corrente
$("#btn-ai").addEventListener("click", () => {
  const capo = currentCapo(); if (!capo) return;
  const key = localStorage.getItem("apikey");
  if (!key) { toast("Imposta prima la chiave AI in ⚙️"); showView("impostazioni"); return; }
  runAI(capo, true);
});

// Esegue l'analisi e compila i campi. Auto-chiamata all'apertura del capo.
async function runAI(capo, force = false) {
  const key = localStorage.getItem("apikey");
  const model = localStorage.getItem("model") || "claude-haiku-4-5-20251001";
  if (!key) return;
  if (capo.aiDone && !force) return;
  setAiStatus("✨ Analizzo la foto…", "loading");
  $("#btn-ai").disabled = true;
  try {
    // leggo prima ciò che è già nel form, per non cancellare il lavoro manuale
    leggiFormNelCapo(capo);
    const result = await analizzaConAI(capo.img, key, model);
    // riempie solo i campi vuoti; con "force" (Ri-analizza) sovrascrive tutto
    const set = (cur, val) => (force || !cur) && val ? val : cur;
    if (result.categoria && CATEGORIE.includes(result.categoria)) capo.categoria = set(capo.categoria, result.categoria);
    capo.tipo = set(capo.tipo, result.tipo);
    capo.colore = set(capo.colore, result.colore);
    if (result.stagione && STAGIONI.includes(result.stagione)) capo.stagione = set(capo.stagione, result.stagione);
    capo.materiale = set(capo.materiale, result.materiale);
    capo.note = set(capo.note, result.descrizione);
    if (force || !(capo.tags || []).length) if (result.tags && result.tags.length) capo.tags = result.tags;
    capo.aiDone = true;
    await putCapo(capo);
    // aggiorna i campi solo se siamo ancora su questo capo
    if (currentCapo() && currentCapo().id === capo.id) {
      $("#f-categoria").value = capo.categoria || "";
      $("#f-tipo").value = capo.tipo || "";
      $("#f-colore").value = capo.colore || "";
      $("#f-stagione").value = capo.stagione || STAGIONI[0];
      $("#f-materiale").value = capo.materiale || "";
      $("#f-note").value = capo.note || "";
      $("#f-tags").value = (capo.tags || []).join(", ");
      setAiStatus("✅ Compilato! Controlla e salva.", "");
      buzz();
    }
  } catch (err) {
    console.error(err);
    if (currentCapo() && currentCapo().id === capo.id)
      setAiStatus("⚠️ " + err.message + " (puoi compilare a mano)", "error");
  } finally {
    $("#btn-ai").disabled = false;
  }
}

async function analizzaConAI(dataUrl, key, model) {
  const base64 = await base64PerAI(dataUrl);
  const prompt = `Cataloga il capo in foto. Rispondi SOLO con JSON valido, in italiano:
{"categoria": una tra ${JSON.stringify(CATEGORIE)}, "tipo":"tipo breve, es. maglione collo alto", "colore":"colore principale", "stagione": una tra ${JSON.stringify(STAGIONI)}, "materiale":"ipotesi, es. cotone", "descrizione":"una frase", "tags":["3 tag, es. elegante, lavoro"]}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 320,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API ${res.status}. Controlla la chiave/credito. ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  let text = (data.content && data.content[0] && data.content[0].text) || "";
  text = text.replace(/```json|```/g, "").trim();
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Risposta AI non interpretabile");
  return JSON.parse(text.slice(start, end + 1));
}

/* ---------- Guardaroba ---------- */
function renderGuardaroba() {
  const grid = $("#grid"), vuoto = $("#guardaroba-vuoto");
  const cat = $("#filter-cat").value, sta = $("#filter-sta").value;
  const q = $("#search").value.trim().toLowerCase();
  let lista = capi.filter(c => c.stato === "catalogato");
  if (cat) lista = lista.filter(c => c.categoria === cat);
  if (sta) lista = lista.filter(c => c.stagione === sta);
  if (q) lista = lista.filter(c =>
    [c.tipo, c.colore, c.categoria, c.materiale, c.note, (c.tags || []).join(" ")]
      .join(" ").toLowerCase().includes(q));
  lista.sort((a, b) => (b.aggiornato || b.creato).localeCompare(a.aggiornato || a.creato));

  vuoto.hidden = lista.length > 0 || capi.some(c => c.stato === "catalogato");
  grid.innerHTML = "";
  for (const c of lista) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `<img src="${c.img}" alt="${c.tipo || c.categoria}" loading="lazy">
      <div class="tile-info"><b>${escapeHtml(c.tipo || c.categoria || "Capo")}</b>
      <span>${escapeHtml([c.colore, c.categoria].filter(Boolean).join(" · "))}</span></div>`;
    tile.addEventListener("click", () => openModal(c));
    grid.appendChild(tile);
  }
}
$("#search").addEventListener("input", renderGuardaroba);
$("#filter-cat").addEventListener("change", renderGuardaroba);
$("#filter-sta").addEventListener("change", renderGuardaroba);

/* ---------- Modal dettaglio ---------- */
function openModal(c) {
  $("#modal-img").src = c.img;
  $("#modal-info").innerHTML = `
    <dl class="modal-info">
      <dt>Tipo</dt><dd>${escapeHtml(c.tipo || "—")}</dd>
      <dt>Categoria</dt><dd>${escapeHtml(c.categoria || "—")}</dd>
      <dt>Colore</dt><dd>${escapeHtml(c.colore || "—")}</dd>
      <dt>Stagione</dt><dd>${escapeHtml(c.stagione || "—")}</dd>
      <dt>Materiale</dt><dd>${escapeHtml(c.materiale || "—")}</dd>
      <dt>Note</dt><dd>${escapeHtml(c.note || "—")}</dd>
      <dt>Tag</dt><dd>${escapeHtml((c.tags || []).join(", ") || "—")}</dd>
    </dl>`;
  $("#modal").hidden = false;
  $("#modal-delete").onclick = () => {
    $("#modal").hidden = true;
    eliminaCapo(c, renderGuardaroba);
  };
}
$("#modal-close").addEventListener("click", () => { $("#modal").hidden = true; });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });

/* ---------- Impostazioni ---------- */
$("#btn-save-settings").addEventListener("click", () => {
  localStorage.setItem("apikey", $("#set-apikey").value.trim());
  localStorage.setItem("model", $("#set-model").value);
  $("#settings-saved").textContent = "✅ Salvato";
  setTimeout(() => $("#settings-saved").textContent = "", 2000);
});

/* ---------- Backup / Ripristino ---------- */
$("#btn-export").addEventListener("click", async () => {
  const dump = { versione: 1, esportato: new Date().toISOString(), capi };
  const blob = new Blob([JSON.stringify(dump)], { type: "application/json" });
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `guardaroba-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("#backup-status").textContent = `✅ Esportati ${capi.length} capi. Salva il file nella cartella Drive.`;
});

$("#import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const dump = JSON.parse(await file.text());
    if (!Array.isArray(dump.capi)) throw new Error("File non valido");
    let nuovi = 0;
    const idEsistenti = new Set(capi.map(c => c.id));
    for (const c of dump.capi) {
      if (!idEsistenti.has(c.id)) { await putCapo(c); capi.push(c); nuovi++; }
    }
    updateCounter();
    $("#backup-status").textContent = `✅ Importati ${nuovi} capi nuovi (i duplicati sono stati saltati).`;
  } catch (err) {
    $("#backup-status").textContent = "⚠️ Errore import: " + err.message;
  }
  e.target.value = "";
});

/* ---------- Helpers ---------- */
let toastTimer;
function toast(msg, actionLabel, actionFn, durata = 2200) {
  const el = $("#toast");
  el.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);
  if (actionLabel && actionFn) {
    const btn = document.createElement("button");
    btn.className = "toast-action";
    btn.textContent = actionLabel;
    btn.onclick = () => { clearTimeout(toastTimer); hideToast(); actionFn(); };
    el.appendChild(btn);
  }
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, durata);
}
function hideToast() {
  const el = $("#toast");
  el.classList.remove("show");
  setTimeout(() => { el.hidden = true; }, 250);
}

// Vibrazione leggera di conferma (solo dove supportata, es. Android)
function buzz(ms = 15) { if (navigator.vibrate) navigator.vibrate(ms); }

// Elimina con possibilità di annullare (niente popup di conferma)
async function eliminaCapo(capo, dopo) {
  await delCapo(capo.id);
  capi = capi.filter(c => c.id !== capo.id);
  updateCounter();
  dopo && dopo();
  toast("Eliminato", "Annulla", async () => {
    await putCapo(capo);
    capi.push(capo);
    updateCounter();
    dopo && dopo();
  }, 4500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function updateCounter() {
  const cat = capi.filter(c => c.stato === "catalogato").length;
  const bz = bozze().length;
  $("#counter").textContent = `${cat} capi · ${bz} da catalogare`;
}

function popolaSelect() {
  const optsCat = CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join("");
  $("#f-categoria").innerHTML = `<option value="">— scegli —</option>` + optsCat;
  $("#filter-cat").innerHTML = `<option value="">Tutte le categorie</option>` + optsCat;
  const optsSta = STAGIONI.map(s => `<option value="${s}">${s}</option>`).join("");
  $("#f-stagione").innerHTML = optsSta;
  $("#filter-sta").innerHTML = `<option value="">Tutte le stagioni</option>` + optsSta;
}

/* ---------- Avvio ---------- */
async function init() {
  popolaSelect();
  $("#set-apikey").value = localStorage.getItem("apikey") || "";
  $("#set-model").value = localStorage.getItem("model") || "claude-haiku-4-5-20251001";
  await openDB();
  capi = await getAll();
  updateCounter();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
init();
