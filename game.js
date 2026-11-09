// Zénith : logique du jeu.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DAILY_COUNT = 7;
  const TIMER_S = 30;
  const MAX_GAIN = 2000, MIN_GAIN = 100;
  const THRUST = 1.15;       // multiplicateur de poussée par bonne réponse (vol infini)
  const REFUEL_EVERY = 10;   // ravitaillement en vol
  const MAX_FUEL = 3;
  const TIERS = ["Banale", "Courante", "Peu commune", "Rare", "Pépite"];
  const TIER_SQ = ["⬜", "🟦", "🟨", "🟧", "🟩"];

  // ---------- Texte ----------
  const ARTICLES = /^(le|la|les|l|un|une|des|du|de|d|the)\s+/;
  function norm(s) {
    let t = String(s).toLowerCase()
      .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/&/g, " et ")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’'`´]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
    let prev;
    do { prev = t; t = t.replace(ARTICLES, ""); } while (t !== prev && t.includes(" "));
    return t.replace(/\s+/g, "");
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  const fmtPct = (p) => {
    const v = p * 100;
    if (v < 0.1) return "< 0,1 %";
    return v.toLocaleString("fr-FR", { maximumFractionDigits: v < 10 ? 1 : 0 }) + " %";
  };
  const plural = (n, w) => n.toLocaleString("fr-FR") + " " + w + (n > 1 ? "s" : "");

  // ---------- Données ----------
  const THEMES = (window.ZDATA || []).slice();
  const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  const QUESTIONS = [];
  THEMES.forEach((t) => t.q.forEach((q, i) => QUESTIONS.push({ id: t.id + ":" + i, theme: t, text: q[0], raw: q[1] })));
  const QBY = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

  function prep(q) {
    if (q.answers) return q;
    const seen = new Set();
    const answers = [];
    for (const chunk of q.raw.split(";")) {
      const names = chunk.split("/").map((s) => s.trim()).filter(Boolean);
      if (!names.length) continue;
      const keys = names.map(norm).filter(Boolean);
      if (!keys.length || seen.has(keys[0])) continue;
      keys.forEach((k) => seen.add(k));
      answers.push({ name: names[0], keys, pkeys: keys.map(phon) });
    }
    // Part estimée de joueurs pour chaque rang (loi de type Zipf)
    const w = answers.map((_, r) => 1 / Math.pow(r + 1.5, 1.1));
    const sum = w.reduce((a, b) => a + b, 0);
    let cum = 0;
    answers.forEach((a, r) => { a.share = w[r] / sum; a.rarity = cum; cum += a.share; a.rank = r; });
    q.answers = answers;
    return q;
  }
  // Clé phonétique simplifiée : « Cntre Vale de Loir » et « Centre-Val de Loire » se rapprochent.
  function phon(k) {
    return k
      .replace(/ph/g, "f").replace(/ck/g, "k").replace(/qu/g, "k").replace(/q/g, "k")
      .replace(/c([eiy])/g, "s$1").replace(/c/g, "k").replace(/g([ei])/g, "j$1")
      .replace(/eau/g, "o").replace(/au/g, "o").replace(/[ae]i/g, "e").replace(/e[nm]/g, "an")
      .replace(/y/g, "i").replace(/w/g, "v").replace(/z/g, "s").replace(/h/g, "")
      .replace(/(.)\1+/g, "$1").replace(/[estxd]+$/, "");
  }
  // Nombre de fautes tolérées selon la longueur (la plus courte des deux chaînes)
  const tolFor = (len) => (len < 5 ? 0 : len < 9 ? 1 : len < 13 ? 2 : Math.min(4, Math.floor(len * 0.2)));

  function match(q, input) {
    const k = norm(input);
    if (!k) return -1;
    const A = prep(q).answers;
    const variants = [k];
    if (k.length > 3 && /[sx]$/.test(k)) variants.push(k.slice(0, -1));
    for (const v of variants) for (const a of A) for (const key of a.keys) if (key === v || key === v + "s") return a.rank;
    const pk = phon(k);
    let best = -1, bestScore = Infinity;
    for (const a of A) {
      for (let i = 0; i < a.keys.length; i++) {
        const key = a.keys[i], pkey = a.pkeys[i];
        // Même prononciation approximative : « Madagaskar », « Marok »
        if (pk.length >= 4 && pk === pkey) { if (bestScore > 0) { bestScore = 0; best = a.rank; } continue; }
        // Réponse partielle : « Val de Loire » pour « Centre-Val de Loire »
        if (k.length >= 6 && k.length >= key.length * 0.5 && (key.startsWith(k) || key.endsWith(k))) {
          const s = 1 / key.length; if (s < bestScore) { bestScore = s; best = a.rank; } continue;
        }
        if (k[0] !== key[0] && pk[0] !== pkey[0]) continue;
        const tol = tolFor(Math.min(k.length, key.length));
        if (!tol) continue;
        const d1 = lev(k, key, tol);
        const ptol = Math.min(k.length, key.length) >= 9 ? 1 : 0;
        const d2 = ptol ? lev(pk, pkey, ptol) : Infinity;
        let d = Math.min(d1 <= tol ? d1 : Infinity, d2 <= ptol ? d2 : Infinity);
        if (d === Infinity) continue;
        const score = d / key.length;
        if (score < bestScore) { bestScore = score; best = a.rank; }
      }
    }
    return best;
  }

  // ---------- Le mot existe-t-il ? ----------
  let dictBits = null, bankTokens = null;
  const tokensOf = (s) => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  function fnv(s, h) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function inDict(t) {
    const D = window.ZDICT;
    if (!D) return true;
    if (!dictBits) { const bin = atob(D.b); dictBits = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) dictBits[i] = bin.charCodeAt(i); }
    const h1 = fnv(t, 2166136261), h2 = (fnv(t, (2166136261 ^ 0x9e3779b9) >>> 0) | 1) >>> 0;
    for (let i = 0; i < D.k; i++) {
      const b = ((h1 + Math.imul(i, h2)) >>> 0) % D.m;
      if (!(dictBits[b >> 3] & (1 << (b & 7)))) return false;
    }
    return true;
  }
  function exists(input) {
    const toks = tokensOf(input);
    const letters = toks.join("").replace(/[0-9]/g, "");
    if (!toks.length) return false;
    if (!letters.length) return true; // un nombre ou une date
    if (letters.length < 2) return false;
    if (/(.)\1\1/.test(letters)) return false; // « aaaa », « zzz »
    if (!bankTokens) {
      bankTokens = new Set();
      for (const q of QUESTIONS) for (const t of tokensOf(q.raw)) bankTokens.add(t);
    }
    return toks.every((t) => t.length < 3 || /^[0-9]+$/.test(t) || bankTokens.has(t) || inDict(t));
  }
  const tierOf = (c) => (c < 0.3 ? 0 : c < 0.55 ? 1 : c < 0.75 ? 2 : c < 0.9 ? 3 : 4);
  const baseGain = (c) => Math.round((MIN_GAIN + (MAX_GAIN - MIN_GAIN) * c) / 10) * 10;

  // ---------- Hasard reproductible ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function todayKey(d = new Date()) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function flightNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000) + 1;
  }
  function dailyQuestions(key) {
    const r = rng(hash("zenith-" + key));
    const themes = shuffle(THEMES, r).slice(0, DAILY_COUNT);
    return themes.map((t) => t.id + ":" + Math.floor(r() * t.q.length));
  }

  // ---------- Sauvegarde ----------
  const STORE_KEY = "zenith-v1";
  const defaults = () => ({ settings: { timer: true, motion: true }, themes: THEMES.map((t) => t.id), daily: {}, best: 0, endless: 0, seen: [] });
  let store = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) store = Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  store.themes = store.themes.filter((id) => THEME_BY_ID[id]);
  if (!store.themes.length) store.themes = THEMES.map((t) => t.id);
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignoré */ } }

  // ---------- Partie ----------
  let game = null;
  let timer = null;

  function newGame(mode) {
    const g = { mode, alt: 0, fuel: MAX_FUEL, correct: 0, picks: [], i: 0, queue: [] };
    if (mode === "daily") {
      g.key = todayKey();
      g.queue = dailyQuestions(g.key);
      const saved = store.daily[g.key];
      if (saved) { g.picks = saved.picks.slice(); g.alt = saved.alt; g.i = saved.picks.length; }
    } else {
      const pool = QUESTIONS.filter((q) => store.themes.includes(q.theme.id)).map((q) => q.id);
      const seen = new Set(store.seen);
      const fresh = pool.filter((id) => !seen.has(id));
      const r = rng(Date.now() & 0xffffffff);
      g.queue = shuffle(fresh, r).concat(shuffle(pool.filter((id) => seen.has(id)), r));
      g.pool = pool;
    }
    return g;
  }
  function currentQ() {
    if (game.mode === "endless" && game.i >= game.queue.length) {
      game.queue = game.queue.concat(shuffle(game.pool, rng(Date.now() & 0xffffffff)));
    }
    return QBY[game.queue[game.i]];
  }
  const mult = () => (game.mode === "endless" ? Math.pow(THRUST, game.correct) : 1);

  // ---------- Écrans ----------
  const SCREENS = ["home", "question", "reveal", "end"];
  function show(name) {
    SCREENS.forEach((s) => ($("screen-" + s).hidden = s !== name));
    $("hud").hidden = name === "home";
    $("panel").scrollTop = 0;
  }
  function renderHud() {
    if (!game) return;
    $("hud-mode").textContent = game.mode === "daily" ? "Vol n°" + flightNumber(game.key) : "Vol infini";
    $("hud-alt").textContent = Alt.fmt(game.alt);
    $("hud-progress").textContent = game.mode === "daily" ? Math.min(game.i + 1, DAILY_COUNT) + " / " + DAILY_COUNT : "Question " + (game.i + 1);
    $("hud-fuel-wrap").hidden = game.mode !== "endless";
    $("hud-mult-wrap").hidden = game.mode !== "endless";
    if (game.mode === "endless") {
      $("hud-fuel").innerHTML = Array.from({ length: MAX_FUEL }, (_, i) => `<i class="${i < game.fuel ? "" : "empty"}"></i>`).join("");
      $("hud-mult").textContent = "×" + mult().toLocaleString("fr-FR", { maximumFractionDigits: mult() < 100 ? 2 : 0, minimumFractionDigits: mult() < 100 ? 2 : 0 });
    }
  }

  function renderHome() {
    game = null;
    stopTimer();
    Sky.setAltitude(0);
    const key = todayKey();
    $("home-date").textContent = "Vol n°" + flightNumber(key) + " · " + new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const d = store.daily[key];
    const done = d && d.picks.length >= DAILY_COUNT;
    $("mode-daily").classList.toggle("done", !!done);
    $("daily-meta").textContent = done ? "Posé à " + Alt.fmt(d.alt) : d ? "Reprendre " + d.picks.length + "/" + DAILY_COUNT : "Prêt au décollage";
    $("endless-meta").textContent = "Record : " + Alt.fmt(store.best);
    renderThemes();
    const st = stats();
    $("home-stats").innerHTML = `<span>Série <b>${plural(st.streak, "jour")}</b></span><span>Meilleur vol du jour <b>${Alt.fmt(st.bestDaily)}</b></span><span><b>${THEMES.length}</b> thèmes · <b>${QUESTIONS.length}</b> questions</span>`;
    show("home");
  }
  function renderThemes() {
    $("theme-picker").innerHTML = THEMES.map((t) =>
      `<button type="button" class="theme-chip" style="--c:${t.color}" data-theme="${t.id}" aria-pressed="${store.themes.includes(t.id)}"><span class="dot"></span>${t.name}</button>`
    ).join("");
    const n = store.themes.length;
    const qn = QUESTIONS.filter((q) => store.themes.includes(q.theme.id)).length;
    $("theme-count").textContent = plural(n, "thème") + " · " + plural(qn, "question");
    $("themes-all").textContent = n === THEMES.length ? "Tout désélectionner" : "Tout sélectionner";
  }

  function ask() {
    const q = prep(currentQ());
    game.answered = false;
    game.unknown = null;
    $("q-theme").style.setProperty("--c", q.theme.color);
    $("q-theme-name").textContent = q.theme.name;
    $("q-accepted").textContent = plural(q.answers.length, "réponse") + " acceptée" + (q.answers.length > 1 ? "s" : "");
    $("q-text").textContent = q.text;
    hint(game.mode === "endless" && game.correct > 0
      ? "Poussée actuelle : chaque mètre gagné compte ×" + mult().toLocaleString("fr-FR", { maximumFractionDigits: 2 })
      : "Vise une réponse que peu de monde donnera.");
    $("answer").value = "";
    renderHud();
    show("question");
    setTimeout(() => $("answer").focus({ preventScroll: true }), 30);
    startTimer();
  }

  function shakeForm() { const f = $("answer-form"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); }
  function hint(text, isError) { const h = $("q-hint"); h.textContent = text; h.classList.toggle("error", !!isError); }

  function startTimer() {
    stopTimer();
    const bar = $("timer-bar"), box = $("timer");
    box.hidden = !store.settings.timer;
    if (!store.settings.timer) return;
    const end = performance.now() + TIMER_S * 1000;
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      bar.style.transform = `scaleX(${left / (TIMER_S * 1000)})`;
      box.classList.toggle("low", left < 8000);
      if (left <= 0) { timer = null; resolve(null, "timeout"); return; }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function stopTimer() { if (timer) cancelAnimationFrame(timer); timer = null; }

  function resolve(input, reason) {
    if (!game || game.answered) return;
    const q = prep(currentQ());
    let idx = -1;
    if (input != null) {
      if (!input.trim()) { shakeForm(); return; }
      idx = match(q, input);
      // Mot inexistant : on laisse retenter, sans pénalité. Le même texte validé deux fois compte.
      if (idx < 0 && norm(input) !== game.unknown && !exists(input)) {
        game.unknown = norm(input);
        game.tries = (game.tries || 0) + 1;
        hint("« " + input.trim() + " » n'existe pas. Vérifie l'orthographe ou tente autre chose. Si tu es sûr de toi, valide à nouveau.", true);
        shakeForm();
        $("answer").select();
        return;
      }
    }
    game.answered = true;
    stopTimer();
    const a = idx >= 0 ? q.answers[idx] : null;
    const gain = a ? Math.round(baseGain(a.rarity) * mult()) : 0;
    const pick = { q: q.id, input: input || "", idx, gain, reason: reason || (a ? "ok" : "wrong") };
    game.picks.push(pick);
    game.alt += gain;
    let refuel = false;
    if (game.mode === "endless") {
      if (a) {
        game.correct++;
        if (game.correct % REFUEL_EVERY === 0 && game.fuel < MAX_FUEL) { game.fuel++; refuel = true; }
      } else game.fuel--;
      if (!store.seen.includes(q.id)) { store.seen.push(q.id); if (store.seen.length > QUESTIONS.length - 20) store.seen = store.seen.slice(-60); }
    } else {
      store.daily[game.key] = { alt: game.alt, picks: game.picks.slice() };
    }
    save();
    Sky.setAltitude(game.alt);
    if (a) Sky.good(a.rarity); else Sky.bad();
    renderReveal(q, a, pick);
    if (refuel) toast("Ravitaillement en vol : +1 réservoir");
  }

  function renderReveal(q, a, pick) {
    $("verdict-q").textContent = q.theme.name + " · " + q.text;
    const v = $("verdict");
    v.classList.toggle("bad", !a);
    if (a) {
      const t = tierOf(a.rarity);
      $("verdict-answer").textContent = a.name;
      $("verdict-gain").textContent = "+" + Alt.fmt(pick.gain);
      $("verdict-tier").textContent = TIERS[t];
      $("verdict-tier").className = "tier t" + t;
      $("verdict-tier").hidden = false;
      $("verdict-share").textContent = "≈ " + fmtPct(a.share) + " des joueurs · rang " + (a.rank + 1) + " sur " + q.answers.length;
      $("meter-pin").style.left = (a.rarity * 100).toFixed(1) + "%";
      $("meter-block").hidden = false;
    } else {
      $("verdict-answer").textContent = pick.reason === "timeout" ? "Temps écoulé" : pick.reason === "skip" ? "Question passée" : "« " + pick.input + " » n'est pas acceptée";
      $("verdict-gain").textContent = game.mode === "endless" ? "−1 réservoir" : "+0 m";
      $("verdict-tier").hidden = true;
      $("verdict-share").textContent = "";
      $("meter-block").hidden = true;
    }
    const top = q.answers.slice(0, 5);
    const r = rng(hash(q.id + pick.input));
    const tail = q.answers.slice(Math.floor(q.answers.length * 0.6));
    const rare = shuffle(tail, r).slice(0, 5).sort((x, y) => x.rank - y.rank);
    const li = (x) => `<li class="${a && x.rank === a.rank ? "mine" : ""}"><span>${esc(x.name)}</span><span>${fmtPct(x.share)}</span></li>`;
    $("list-top").innerHTML = top.map(li).join("");
    $("list-rare").innerHTML = rare.map(li).join("");
    const last = game.mode === "daily" ? game.picks.length >= DAILY_COUNT : game.fuel <= 0;
    $("btn-next").textContent = last ? "Voir mon vol" : "Question suivante";
    $("reveal-note").textContent = a && a.rank === 0 ? "C'est la réponse la plus évidente. La prochaine fois, ose plus rare !" : "";
    renderHud();
    show("reveal");
    setTimeout(() => $("btn-next").focus({ preventScroll: true }), 30);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function next() {
    if (!game) return;
    game.i++;
    const over = game.mode === "daily" ? game.i >= DAILY_COUNT : game.fuel <= 0;
    if (over) return finish();
    ask();
  }

  function finish() {
    stopTimer();
    const g = game;
    let record = false;
    if (g.mode === "endless") {
      store.endless++;
      if (g.alt > store.best) { store.best = g.alt; record = true; }
      save();
    }
    $("end-title").textContent = g.mode === "daily" ? "Vol n°" + flightNumber(g.key) + " terminé" : record ? "Nouveau record !" : "Panne sèche";
    $("end-alt").textContent = Alt.fmt(g.alt);
    $("end-layer").textContent = Alt.layerOf(g.alt);
    const nm = Alt.nextMilestone(g.alt);
    $("end-next").textContent = nm ? "Prochain repère : " + nm[1] + " à " + Alt.fmt(nm[0]) + "." : "Tu as atteint le bord de l'Univers observable.";
    $("recap").innerHTML = g.picks.map((p, i) => {
      const q = prep(QBY[p.q]);
      const a = p.idx >= 0 ? q.answers[p.idx] : null;
      const label = a ? esc(a.name) + ` <small>${esc(q.text)} · ${TIERS[tierOf(a.rarity)].toLowerCase()}</small>` : `<span style="color:var(--bad)">${p.reason === "timeout" ? "Temps écoulé" : p.reason === "skip" ? "Passée" : "Refusée : " + esc(p.input)}</span><small>${esc(q.text)}</small>`;
      return `<li><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="a">${label}</span><span class="g ${p.gain ? "" : "zero"}">${p.gain ? "+" + Alt.fmt(p.gain) : "0"}</span></li>`;
    }).join("");
    $("share-box").textContent = shareText(g);
    $("btn-endless").textContent = g.mode === "endless" ? "Redécoller" : "Vol infini";
    renderHud();
    show("end");
  }

  function shareText(g) {
    const sq = g.picks.map((p) => {
      if (p.idx < 0) return "🟥";
      const q = prep(QBY[p.q]);
      return TIER_SQ[tierOf(q.answers[p.idx].rarity)];
    });
    const lines = [];
    if (g.mode === "daily") lines.push("Zénith · Vol n°" + flightNumber(g.key));
    else lines.push("Zénith · Vol infini · " + plural(g.picks.length, "question"));
    lines.push("✈️ " + Alt.fmt(g.alt) + " · " + Alt.layerOf(g.alt));
    for (let i = 0; i < sq.length; i += 10) lines.push(sq.slice(i, i + 10).join(""));
    return lines.join("\n");
  }

  // ---------- Statistiques ----------
  function stats() {
    const keys = Object.keys(store.daily).filter((k) => store.daily[k].picks.length >= DAILY_COUNT).sort();
    const alts = keys.map((k) => store.daily[k].alt);
    let streak = 0;
    const d = new Date();
    if (!store.daily[todayKey(d)] || store.daily[todayKey(d)].picks.length < DAILY_COUNT) d.setDate(d.getDate() - 1);
    while (store.daily[todayKey(d)] && store.daily[todayKey(d)].picks.length >= DAILY_COUNT) { streak++; d.setDate(d.getDate() - 1); }
    return {
      played: keys.length, streak,
      bestDaily: alts.length ? Math.max(...alts) : 0,
      avg: alts.length ? alts.reduce((a, b) => a + b, 0) / alts.length : 0,
      keys
    };
  }
  function renderStats() {
    const s = stats();
    const cell = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    $("stats-grid").innerHTML =
      cell(s.played, "vols du jour") + cell(s.streak, "jours de série") +
      cell(Alt.fmt(s.bestDaily), "meilleur vol du jour") + cell(Alt.fmt(s.avg), "altitude moyenne") +
      cell(Alt.fmt(store.best), "record vol infini") + cell(store.endless, "vols infinis");
    const hist = s.keys.slice(-10).reverse();
    $("stats-history").innerHTML = hist.length
      ? hist.map((k) => `<li><span class="n">${flightNumber(k)}</span><span class="a">${new Date(k + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} <small>${Alt.layerOf(store.daily[k].alt)}</small></span><span class="g">${Alt.fmt(store.daily[k].alt)}</span></li>`).join("")
      : `<li><span class="n">–</span><span class="a">Aucun vol du jour terminé pour l'instant.</span><span></span></li>`;
  }

  // ---------- Interface ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400);
  }
  function openModal(id) { $(id).hidden = false; const b = $(id).querySelector("[data-close]"); if (b) b.focus(); }
  function closeModals() { document.querySelectorAll(".modal").forEach((m) => (m.hidden = true)); }

  $("mode-daily").addEventListener("click", () => {
    game = newGame("daily");
    Sky.setAltitude(game.alt);
    if (game.i >= DAILY_COUNT) finish(); else ask();
  });
  function startEndless() {
    if (!store.themes.length) { toast("Choisis au moins un thème."); return; }
    game = newGame("endless");
    Sky.setAltitude(0);
    ask();
  }
  $("mode-endless").addEventListener("click", startEndless);
  $("btn-endless").addEventListener("click", startEndless);
  $("btn-home").addEventListener("click", renderHome);
  $("brand").addEventListener("click", renderHome);

  $("theme-picker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]"); if (!b) return;
    const id = b.dataset.theme;
    store.themes = store.themes.includes(id) ? store.themes.filter((x) => x !== id) : store.themes.concat(id);
    save(); renderThemes();
  });
  $("themes-all").addEventListener("click", () => {
    store.themes = store.themes.length === THEMES.length ? [] : THEMES.map((t) => t.id);
    save(); renderThemes();
  });

  $("answer-form").addEventListener("submit", (e) => { e.preventDefault(); resolve($("answer").value); });
  $("btn-skip").addEventListener("click", () => resolve(null, "skip"));
  $("btn-next").addEventListener("click", next);

  $("btn-copy").addEventListener("click", () => {
    const text = $("share-box").textContent;
    const done = () => toast("Résultat copié");
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("share-box"));
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      toast("Texte sélectionné : copie-le avec Ctrl+C");
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  });

  $("btn-help").addEventListener("click", () => openModal("modal-help"));
  $("btn-stats").addEventListener("click", () => { renderStats(); openModal("modal-stats"); });
  $("btn-settings").addEventListener("click", () => {
    $("set-timer").checked = store.settings.timer;
    $("set-motion").checked = store.settings.motion;
    $("btn-reset").textContent = "Effacer ma progression";
    resetArmed = false;
    openModal("modal-settings");
  });
  document.querySelectorAll(".modal").forEach((m) => m.addEventListener("click", (e) => {
    if (e.target === m || e.target.closest("[data-close]")) closeModals();
  }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
    if (e.key === "Enter" && !$("screen-reveal").hidden && document.activeElement !== $("btn-next") && $("modal-help").hidden) { e.preventDefault(); next(); }
  });
  $("set-timer").addEventListener("change", (e) => { store.settings.timer = e.target.checked; save(); });
  $("set-motion").addEventListener("change", (e) => { store.settings.motion = e.target.checked; Sky.setMotion(e.target.checked); save(); });
  let resetArmed = false;
  $("btn-reset").addEventListener("click", () => {
    if (!resetArmed) { resetArmed = true; $("btn-reset").textContent = "Confirmer l'effacement"; return; }
    store = defaults(); save(); closeModals(); renderHome(); toast("Progression effacée");
  });

  // ---------- Démarrage ----------
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Sky.setMotion(store.settings.motion && !reduce);
  Sky.setAltitude(0, true);
  renderHome();

  // Accès pour les tests
  window.Zenith = { norm, exists, phon, match: (id, s) => match(QBY[id], s), prep: (id) => prep(QBY[id]), QUESTIONS, dailyQuestions };
})();
