// Ciel, décor animé, avion et bande d'altitude, dessinés en canvas.
// L'échelle verticale est logarithmique : chaque décade d'altitude occupe la même hauteur,
// ce qui permet d'aller de la piste à la galaxie d'Andromède sans perdre le mouvement.
(function () {
  const AU = 1.496e11, LY = 9.461e15, TAU = Math.PI * 2;

  function fmtAlt(m) {
    m = Math.max(0, m);
    if (m < 100000) return Math.round(m).toLocaleString("fr-FR") + " m";
    if (m < 1e12) return Math.round(m / 1000).toLocaleString("fr-FR") + " km";
    if (m < LY * 0.5) return (m / AU).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " UA";
    return (m / LY).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " al";
  }
  function fmtShort(m) {
    if (m < 1000) return Math.round(m) + "";
    if (m < 1e6) return (m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "k";
    if (m < 1e9) return (m / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "M";
    if (m < LY * 0.5) return (m / AU).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + "UA";
    return (m / LY).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "al";
  }

  // [altitude, nom, couleur du corps céleste, taille relative, type]
  const MILESTONES = [
    [0, "Piste de décollage"],
    [330, "Tour Eiffel"],
    [828, "Burj Khalifa"],
    [4808, "Mont Blanc"],
    [8849, "Everest"],
    [11000, "Croisière d'un long-courrier"],
    [18000, "Croisière du Concorde"],
    [38969, "Saut de Felix Baumgartner"],
    [50000, "Stratopause"],
    [85000, "Mésopause, étoiles filantes"],
    [100000, "Ligne de Kármán : l'espace"],
    [408000, "Station spatiale internationale", null, 0, "iss"],
    [20200000, "Satellites GPS"],
    [35786000, "Orbite géostationnaire"],
    [384400000, "La Lune", "#d9d6cf", 0.1, "moon"],
    [5.46e10, "Mars au plus proche", "#d0643c", 0.06],
    [AU, "Distance du Soleil", "#ffd36b", 0.17, "sun"],
    [4.2e11, "Ceinture d'astéroïdes"],
    [5.88e11, "Jupiter", "#d8b48a", 0.13, "jupiter"],
    [1.2e12, "Saturne", "#e6d39a", 0.09, "saturn"],
    [4.3e12, "Neptune", "#5b8ff0", 0.07],
    [5.9e12, "Pluton", "#c7b3a0", 0.04],
    [2.5e13, "Sonde Voyager 1", null, 0, "voyager"],
    [4.01e16, "Proxima du Centaure", "#ff9a6a", 0.05],
    [8.1e16, "Sirius", "#cfe3ff", 0.05],
    [2.46e20, "Centre de la Voie lactée"],
    [2.37e22, "Galaxie d'Andromède", null, 0, "galaxy"],
    [4.4e26, "Bord de l'Univers observable"]
  ];
  const LAYERS = [
    [0, "Troposphère"], [12000, "Stratosphère"], [50000, "Mésosphère"], [85000, "Thermosphère"],
    [100000, "Espace"], [35786000, "Orbite haute"], [3e8, "Espace lunaire"], [3e10, "Système solaire"],
    [2e13, "Espace interstellaire"], [1e19, "Voie lactée"], [1e21, "Espace intergalactique"]
  ];
  function layerOf(m) { let name = LAYERS[0][1]; for (const [a, n] of LAYERS) if (m >= a) name = n; return name; }
  function nextMilestone(m) { for (const ms of MILESTONES) if (ms[0] > m) return ms; return null; }

  const OFF = 300;
  const toL = (m) => Math.log10(Math.max(0, m) + OFF);
  const fromL = (L) => Math.pow(10, L) - OFF;
  const L0 = toL(0);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const band = (L, a, b, fade) => clamp01(Math.min((L - toL(a)) / fade + 1, (toL(b) - L) / fade + 1));

  const STOPS = [
    [L0, "#4fa8f0", "#d6efff"], [3.5, "#3b8ee6", "#a9d8fa"], [4.05, "#2367c2", "#78b4ee"],
    [4.3, "#12387f", "#3e7ac8"], [4.7, "#08174a", "#1c3c80"], [5.0, "#030718", "#0b1a44"],
    [5.6, "#01030a", "#050b1e"], [9, "#000000", "#02040d"], [30, "#000000", "#02040d"]
  ];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(a, b, t) { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; }
  function skyColors(L) {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [la, ta, ba] = STOPS[i], [lb, tb, bb] = STOPS[i + 1];
      if (L <= lb) { const t = clamp01((L - la) / (lb - la)); return [mix(ta, tb, t), mix(ba, bb, t)]; }
    }
    return ["#000", "#02040d"];
  }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = rng(42);
  const between = (a, b) => toL(a + (b - a) * R());
  const logBetween = (a, b) => toL(Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * R()));

  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  let curL = L0, targetL = L0;
  let motion = true, shake = 0, glow = 0;
  let t0 = performance.now(), time = 0;
  const trail = [], particles = [], meteors = [];

  // ---------- Sprites pré-rendus ----------
  function sprite(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }

  function cloudSprite(w, seed) {
    const r = rng(seed), h = Math.round(w * 0.55);
    return sprite(w, h, (g) => {
      const puffs = 5 + Math.floor(r() * 5), base = h * 0.78;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < puffs; i++) {
          const t = (i + 0.5) / puffs, px = w * (0.12 + t * 0.76);
          const pr = w * (0.09 + r() * 0.1) * (1 - Math.abs(t - 0.5) * 0.9);
          const py = base - pr * (0.5 + r() * 0.5);
          const gr = g.createRadialGradient(px - pr * 0.3, py - pr * 0.5, pr * 0.1, px, py, pr);
          if (pass === 0) { gr.addColorStop(0, "rgba(160,182,210,0.9)"); gr.addColorStop(1, "rgba(160,182,210,0)"); g.fillStyle = gr; g.beginPath(); g.arc(px + 3, py + 6, pr * 1.05, 0, TAU); g.fill(); }
          else { gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.7, "rgba(240,246,255,0.96)"); gr.addColorStop(1, "rgba(214,228,246,0)"); g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); }
        }
      }
      const gb = g.createLinearGradient(0, base - 12, 0, base + 10);
      gb.addColorStop(0, "rgba(236,243,252,0.95)"); gb.addColorStop(1, "rgba(170,192,220,0)");
      g.fillStyle = gb; g.beginPath(); g.ellipse(w / 2, base, w * 0.42, 12, 0, 0, TAU); g.fill();
    });
  }

  const GROUND_W = 1400;
  const groundSprite = sprite(GROUND_W, 240, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = "#5f8f4f"; g.fillRect(0, 0, w, h);
    const fields = ["#6f9e55", "#88ad5a", "#a9b85f", "#c8b466", "#5c8a47", "#7aa35b", "#94a85a"];
    for (let x = 0; x < w;) {
      const fw = 60 + r() * 140;
      for (let y = 34; y < h;) {
        const fh = 22 + r() * 50;
        g.fillStyle = fields[Math.floor(r() * fields.length)];
        g.fillRect(x, y, fw - 2, fh - 2);
        g.strokeStyle = "rgba(0,0,0,0.07)"; g.lineWidth = 1;
        for (let s = 4; s < fh - 2; s += 5) { g.beginPath(); g.moveTo(x, y + s); g.lineTo(x + fw - 2, y + s); g.stroke(); }
        y += fh;
      }
      x += fw;
    }
    // haies d'arbres
    for (let i = 0; i < 160; i++) {
      const x = r() * w, y = 36 + r() * (h - 40), s = 3 + r() * 5;
      g.fillStyle = "rgba(30,60,30,0.35)"; g.beginPath(); g.arc(x + 2, y + 2, s, 0, TAU); g.fill();
      g.fillStyle = r() > 0.5 ? "#3f6e37" : "#4c7d3f"; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    // village
    for (let i = 0; i < 26; i++) {
      const x = 820 + r() * 260, y = 50 + r() * 60;
      g.fillStyle = "#e8dcc6"; g.fillRect(x, y, 10, 7);
      g.fillStyle = "#b5523b"; g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + 5, y - 5); g.lineTo(x + 11, y); g.fill();
    }
    // route
    g.strokeStyle = "#8d8f88"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 120);
    for (let x = 0; x <= w; x += 50) g.lineTo(x, 120 + Math.sin(x * 0.01) * 30);
    g.stroke();
  });

  const hillsSprite = sprite(GROUND_W, 90, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#8fb4d6"); gr.addColorStop(1, "#a9c7e2");
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) g.lineTo(x, 40 - Math.sin((x / w) * TAU * 3) * 18 - Math.sin((x / w) * TAU * 7) * 8);
    g.lineTo(w, h); g.fill();
    g.fillStyle = "#f4f8fc"; // neige sur les sommets
    for (let x = 0; x <= w; x += 10) { const y = 40 - Math.sin((x / w) * TAU * 3) * 18 - Math.sin((x / w) * TAU * 7) * 8; if (y < 20) g.fillRect(x, y, 10, 4); }
  });

  const noise = sprite(160, 160, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 26; }
    g.putImageData(img, 0, 0);
  });
  let noisePattern = null;

  const galaxySprite = sprite(420, 420, (g, w) => {
    const r = rng(11), c = w / 2;
    const core = g.createRadialGradient(c, c, 0, c, c, w * 0.22);
    core.addColorStop(0, "rgba(255,240,220,1)"); core.addColorStop(1, "rgba(200,170,255,0)");
    g.fillStyle = core; g.beginPath(); g.arc(c, c, w * 0.22, 0, TAU); g.fill();
    for (let i = 0; i < 2600; i++) {
      const arm = i % 2, d = Math.pow(r(), 0.7) * w * 0.48, a = d * 0.028 + arm * Math.PI + (r() - 0.5) * 0.5;
      g.fillStyle = r() > 0.85 ? "rgba(255,170,200,0.8)" : "rgba(210,220,255,0.7)";
      g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.45, 1.4, 1.4);
    }
  });

  const nebulae = Array.from({ length: 7 }, (_, i) => {
    const col = ["#7a3cff", "#ff4f9a", "#2fb7ff", "#ff8a3c", "#4fffc0", "#b04fff", "#ff5f5f"][i];
    return { L: logBetween(5e14, 5e21), x: R(), size: 0.5 + R() * 0.6, spr: sprite(300, 300, (g, w) => {
      const r = rng(100 + i);
      for (let k = 0; k < 14; k++) {
        const x = w * (0.25 + r() * 0.5), y = w * (0.25 + r() * 0.5), rr = w * (0.12 + r() * 0.2);
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, col + "55"); gr.addColorStop(1, col + "00");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      }
    }) };
  });

  // ---------- Entités du décor ----------
  const STARS = Array.from({ length: 260 }, () => ({ x: R(), y: R(), r: R() * 1.3 + 0.3, tw: R() * TAU }));
  const CLOUDS = Array.from({ length: 42 }, (_, i) => {
    const depth = i % 3 === 0 ? 0.55 : i % 3 === 1 ? 0.8 : 1.15;
    const w = Math.round((70 + R() * 130) * depth);
    return { L: logBetween(350, 11500), x: R(), depth, w, spr: cloudSprite(w, 1000 + i), speed: (0.004 + R() * 0.008) * depth, a: 0.55 + depth * 0.35 };
  });
  const BIRDS = Array.from({ length: 7 }, () => ({ L: logBetween(120, 2600), x: R(), n: 4 + Math.floor(R() * 6), speed: 0.012 + R() * 0.02, ph: R() * TAU, s: 0.7 + R() * 0.6 }));
  const BALLOONS = Array.from({ length: 6 }, (_, i) => ({ L: logBetween(350, 3500), x: R(), speed: 0.003 + R() * 0.004, s: 0.6 + R() * 0.6, c: [["#ff6b5b", "#ffd35b"], ["#5bb8ff", "#ffffff"], ["#8be36b", "#ffe36b"], ["#c06bff", "#ff9ad5"], ["#ff9a3c", "#3c6bff"], ["#ffffff", "#ff5b7f"]][i] }));
  const JETS = Array.from({ length: 4 }, () => ({ L: between(8500, 12500), x: R(), speed: (R() > 0.5 ? 1 : -1) * (0.02 + R() * 0.02), s: 0.35 + R() * 0.25 }));
  const SATS = Array.from({ length: 9 }, () => ({ L: logBetween(5e5, 4e7), x: R(), speed: 0.01 + R() * 0.03, ph: R() * TAU }));
  const ROCKS = Array.from({ length: 70 }, () => ({ L: logBetween(3.0e11, 5.2e11), x: R(), r: 2 + R() * 7, rot: R() * TAU, speed: 0.002 + R() * 0.006 }));
  const PROBE_BALLOON = { L: toL(32000), x: 0.62 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    noisePattern = ctx.createPattern(noise, "repeat");
  }
  window.addEventListener("resize", resize);
  resize();

  const planeX = () => (W < 700 ? W * 0.3 : W * 0.36);
  const planeY = () => (W < 700 ? H * 0.27 : H * 0.33);
  const K = () => Math.max(260, H * 0.6);
  const yOf = (L, depth = 1) => planeY() - (L - curL) * K() * depth;
  const xWrap = (x, speed, margin = 0.15) => ((((x + time * speed) % (1 + 2 * margin)) + (1 + 2 * margin)) % (1 + 2 * margin) - margin) * W;
  const visible = (y, m = 120) => y > -m && y < H + m;

  // ---------- Dessin ----------
  function drawSun(L) {
    const space = clamp01((L - 4.6) / 0.6);
    const x = W * 0.84, y = H * 0.13 + Math.max(0, (L - 6) * 40);
    if (L > 11.5) return; // trop loin : le Soleil n'est plus qu'une étoile
    const r = 26 - space * 6;
    ctx.save();
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * (7 - space * 3));
    halo.addColorStop(0, `rgba(255,245,210,${0.75 - space * 0.2})`); halo.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 7, 0, TAU); ctx.fill();
    if (space < 0.9) {
      ctx.translate(x, y); ctx.rotate(time * 0.04);
      ctx.fillStyle = `rgba(255,240,200,${0.12 * (1 - space)})`;
      for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 9, -r * 0.35); ctx.lineTo(r * 9, r * 0.35); ctx.fill(); }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    ctx.fillStyle = space > 0.5 ? "#ffffff" : "#fff6d6";
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawStars(L) {
    const a = clamp01((L - 4.2) / 0.8);
    if (a <= 0) return;
    const shift = (L * 60) % H;
    ctx.fillStyle = "#fff";
    for (const s of STARS) {
      const y = (s.y * H + shift) % H;
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(time * 1.5 + s.tw));
      ctx.beginPath(); ctx.arc(s.x * W, y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Voie lactée en écharpe
    if (a > 0.3) {
      ctx.save(); ctx.globalAlpha = (a - 0.3) * 0.35;
      ctx.translate(W / 2, H / 2); ctx.rotate(-0.5);
      const g = ctx.createLinearGradient(0, -90, 0, 90);
      g.addColorStop(0, "rgba(160,170,255,0)"); g.addColorStop(0.5, "rgba(200,190,255,0.5)"); g.addColorStop(1, "rgba(160,170,255,0)");
      ctx.fillStyle = g; ctx.fillRect(-W, -90, W * 2, 180); ctx.restore();
    }
  }

  function drawNebulae(L) {
    for (const n of nebulae) {
      const y = yOf(n.L, 0.5), s = Math.min(W, H) * n.size * 1.4;
      if (!visible(y, s)) continue;
      ctx.drawImage(n.spr, n.x * W - s / 2, y - s / 2, s, s);
    }
  }

  function drawEarthCurve(L) {
    if (L < 4.6) return;
    const far = Math.max(0, L - 4.6);
    const r = Math.max(30, 4000 / Math.pow(1 + far * 2.2, 2.2));
    const cy = H + r * 0.82 - Math.min(H * 0.25, far * 80);
    if (cy - r > H) return;
    ctx.save();
    ctx.globalAlpha = clamp01(1.6 - far * 0.25);
    const g = ctx.createRadialGradient(W * 0.45, cy - r * 0.3, r * 0.1, W * 0.5, cy, r);
    g.addColorStop(0, "#3f95e8"); g.addColorStop(0.7, "#1b5aa8"); g.addColorStop(1, "#0d2f66");
    ctx.shadowColor = "rgba(127,195,255,0.9)"; ctx.shadowBlur = 40;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * 0.5, cy, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(W * 0.5, cy, r, 0, TAU); ctx.clip();
    // continents et nuages qui tournent
    const rr = rng(5);
    for (let i = 0; i < 16; i++) {
      const ang = rr() * TAU + time * 0.01, d = rr() * r * 0.9;
      ctx.fillStyle = i % 3 ? "rgba(98,150,80,0.75)" : "rgba(196,176,120,0.7)";
      ctx.beginPath(); ctx.ellipse(W * 0.5 + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, r * (0.06 + rr() * 0.12), r * (0.03 + rr() * 0.06), ang, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 20; i++) {
      const ang = rr() * TAU - time * 0.015, d = rr() * r;
      ctx.beginPath(); ctx.ellipse(W * 0.5 + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, r * (0.05 + rr() * 0.1), r * 0.015, ang * 0.3, 0, TAU); ctx.fill();
    }
    // atmosphère
    const atm = ctx.createRadialGradient(W * 0.5, cy, r * 0.94, W * 0.5, cy, r);
    atm.addColorStop(0, "rgba(140,200,255,0)"); atm.addColorStop(1, "rgba(170,220,255,0.8)");
    ctx.fillStyle = atm; ctx.fillRect(0, cy - r, W, r * 2);
    ctx.restore();
  }

  function drawGround() {
    const y = yOf(L0) + 26;
    if (y > H + 260) return;
    const scroll = motion ? (time * 30) % GROUND_W : 0;
    const hs = motion ? (time * 6) % GROUND_W : 0;
    for (let x = -hs; x < W; x += GROUND_W) ctx.drawImage(hillsSprite, x, y - 70);
    for (let x = -scroll; x < W; x += GROUND_W) ctx.drawImage(groundSprite, x, y);
    if (y + 240 < H) { ctx.fillStyle = "#4f7c42"; ctx.fillRect(0, y + 238, W, H - y - 238); }
    // brume au sol
    const haze = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    haze.addColorStop(0, "rgba(214,239,255,0)"); haze.addColorStop(0.6, "rgba(214,239,255,0.45)"); haze.addColorStop(1, "rgba(214,239,255,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, y - 40, W, 80);
    // piste, balisage et tour de contrôle
    ctx.fillStyle = "#3a3f47"; ctx.fillRect(0, y + 4, W, 22);
    ctx.fillStyle = "#e9edf2";
    for (let x = -(scroll * 2 % 70); x < W; x += 70) ctx.fillRect(x, y + 14, 34, 2);
    const blink = Math.floor(time * 2.5) % 2;
    for (let x = -(scroll * 2 % 40); x < W; x += 40) {
      ctx.fillStyle = blink ? "#ffe9a8" : "#ffcf5a"; ctx.fillRect(x, y + 4, 3, 2);
      ctx.fillStyle = "#7be3ff"; ctx.fillRect(x + 20, y + 24, 3, 2);
    }
    const span = W + 400;
    const towerX = (((W * 0.12 - scroll * 2) % span) + span) % span - 200;
    ctx.fillStyle = "#cfd6df"; ctx.fillRect(towerX, y - 46, 10, 50);
    ctx.fillStyle = "#2b3a52"; ctx.fillRect(towerX - 6, y - 58, 22, 12);
    ctx.fillStyle = blink ? "#ff4f4f" : "#7a2020"; ctx.fillRect(towerX + 3, y - 62, 4, 4);
    // manche à air
    const wx = towerX + 70;
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, y + 4); ctx.lineTo(wx, y - 20); ctx.stroke();
    ctx.fillStyle = "#ff7a2a";
    ctx.beginPath(); ctx.moveTo(wx, y - 20); ctx.lineTo(wx + 18, y - 16 + Math.sin(time * 6) * 2); ctx.lineTo(wx + 18, y - 12 + Math.sin(time * 6) * 2); ctx.lineTo(wx, y - 14); ctx.fill();
  }

  function drawClouds(front) {
    for (const c of CLOUDS) {
      if ((c.depth > 1) !== front) continue;
      const y = yOf(c.L, c.depth);
      if (!visible(y, c.w)) continue;
      const x = xWrap(c.x, motion ? -c.speed : 0, 0.2);
      ctx.globalAlpha = c.a * clamp01((toL(13000) - c.L) * 8);
      ctx.drawImage(c.spr, x - c.w / 2, y - c.spr.height * 0.78, c.w, c.spr.height);
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds() {
    ctx.strokeStyle = "rgba(25,35,50,0.75)"; ctx.lineCap = "round";
    for (const b of BIRDS) {
      const y0 = yOf(b.L, 0.9);
      if (!visible(y0)) continue;
      const x0 = xWrap(b.x, motion ? b.speed : 0, 0.2);
      for (let i = 0; i < b.n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const x = x0 - row * 14 * b.s, y = y0 + side * row * 9 * b.s;
        const f = Math.sin(time * 9 + b.ph + i) * 4 * b.s;
        ctx.lineWidth = 1.6 * b.s;
        ctx.beginPath(); ctx.moveTo(x - 6 * b.s, y - f); ctx.quadraticCurveTo(x - 2 * b.s, y - 2, x, y); ctx.quadraticCurveTo(x + 2 * b.s, y - 2, x + 6 * b.s, y - f); ctx.stroke();
      }
    }
  }

  function drawBalloons() {
    for (const b of BALLOONS) {
      const y = yOf(b.L, 0.85) + Math.sin(time * 0.8 + b.x * 10) * 6;
      if (!visible(y)) continue;
      const x = xWrap(b.x, motion ? b.speed : 0, 0.2), s = 18 * b.s;
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath(); ctx.moveTo(0, s * 1.3); ctx.bezierCurveTo(-s * 1.3, s * 0.3, -s * 1.1, -s * 1.2, 0, -s * 1.2); ctx.bezierCurveTo(s * 1.1, -s * 1.2, s * 1.3, s * 0.3, 0, s * 1.3); ctx.closePath();
      ctx.fillStyle = b.c[0]; ctx.fill(); ctx.clip();
      ctx.fillStyle = b.c[1];
      for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * s * 0.28, -s * 1.3, s * 0.28, s * 2.7);
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(s * 0.25, -s * 1.3, s, s * 2.7);
      ctx.restore();
      ctx.strokeStyle = "rgba(60,40,20,0.8)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 1.25); ctx.lineTo(x - s * 0.22, y + s * 1.7); ctx.moveTo(x + s * 0.3, y + s * 1.25); ctx.lineTo(x + s * 0.22, y + s * 1.7); ctx.stroke();
      ctx.fillStyle = "#7a5230"; ctx.fillRect(x - s * 0.25, y + s * 1.7, s * 0.5, s * 0.35);
    }
  }

  function drawJets() {
    for (const j of JETS) {
      const y = yOf(j.L, 0.7);
      if (!visible(y)) continue;
      const x = xWrap(j.x, motion ? j.speed : 0, 0.3), dir = Math.sign(j.speed), s = j.s;
      const g = ctx.createLinearGradient(x, y, x - dir * W * 0.4, y);
      g.addColorStop(0, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - dir * 20 * s, y); ctx.lineTo(x - dir * W * 0.4, y + 2); ctx.stroke();
      ctx.fillStyle = "#e8eef6";
      ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
      ctx.fillRect(-24, -3, 48, 6); ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-10, 14); ctx.lineTo(-4, 14); ctx.lineTo(12, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -3); ctx.lineTo(-26, -13); ctx.lineTo(-20, -13); ctx.lineTo(-12, -3); ctx.fill();
      ctx.restore();
    }
  }

  function drawUpperAtmosphere(L) {
    // ballon-sonde
    const by = yOf(PROBE_BALLOON.L, 0.9) + Math.sin(time) * 5;
    if (visible(by)) {
      const bx = PROBE_BALLOON.x * W;
      const g = ctx.createRadialGradient(bx - 6, by - 8, 2, bx, by, 22);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c9d3e0");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 20, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.moveTo(bx, by + 20); ctx.lineTo(bx, by + 50); ctx.stroke();
      ctx.fillStyle = "#ff8a3c"; ctx.fillRect(bx - 5, by + 50, 10, 8);
    }
    // nuages noctulescents (~82 km)
    const nl = band(L, 60000, 120000, 0.15);
    if (nl > 0) {
      const y = yOf(toL(82000));
      ctx.strokeStyle = `rgba(140,210,255,${0.25 * nl})`; ctx.lineWidth = 1.2;
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + i * 3 + Math.sin(x * 0.012 + i * 0.6 + time * 0.3) * 10);
        ctx.stroke();
      }
    }
    // aurores polaires (100-400 km)
    const au = band(L, 90000, 500000, 0.12);
    if (au > 0) {
      const yb = yOf(toL(110000)), yt = yOf(toL(320000));
      for (let layer = 0; layer < 2; layer++) {
        for (let x = 0; x <= W; x += 4) {
          const wave = Math.sin(x * 0.01 + time * (0.6 + layer * 0.3) + layer) * 0.5 + Math.sin(x * 0.023 - time * 0.4) * 0.5;
          const top = yt + (yb - yt) * (0.15 + 0.35 * (wave * 0.5 + 0.5));
          const g = ctx.createLinearGradient(0, yb, 0, top);
          const streak = Math.pow(0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(x * 0.05 + time) * 3), 3);
          const a = au * (0.08 + 0.3 * streak);
          g.addColorStop(0, `rgba(80,255,170,${a})`); g.addColorStop(0.6, `rgba(120,255,200,${a * 0.4})`); g.addColorStop(1, layer ? `rgba(200,110,255,${a * 0.5})` : "rgba(80,255,170,0)");
          ctx.fillStyle = g; ctx.fillRect(x + layer * 2, top, 3, yb - top);
        }
      }
    }
  }

  function drawMeteors(L) {
    const rate = band(L, 60000, 1.5e5, 0.2) * 2.5 + (L > 5.2 ? 0.25 : 0);
    if (motion && Math.random() < rate * 0.016) meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.6, vx: -380 - Math.random() * 300, vy: 220 + Math.random() * 180, life: 1 });
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx * 0.016; m.y += m.vy * 0.016; m.life -= 0.025;
      if (m.life <= 0) { meteors.splice(i, 1); continue; }
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.12, m.y - m.vy * 0.12);
      g.addColorStop(0, `rgba(255,255,255,${m.life})`); g.addColorStop(1, "rgba(255,200,150,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.12, m.y - m.vy * 0.12); ctx.stroke();
    }
  }

  function drawSatellites() {
    for (const s of SATS) {
      const y = yOf(s.L, 0.8);
      if (!visible(y)) continue;
      const x = xWrap(s.x, motion ? s.speed : 0, 0.1);
      ctx.fillStyle = "#cfd6df"; ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = "#2f5fbf"; ctx.fillRect(x - 14, y - 2, 9, 4); ctx.fillRect(x + 5, y - 2, 9, 4);
      if (Math.sin(time * 4 + s.ph) > 0.85) { ctx.fillStyle = "#ff5f5f"; ctx.beginPath(); ctx.arc(x, y - 5, 1.6, 0, TAU); ctx.fill(); }
    }
  }

  function drawRocks() {
    for (const r of ROCKS) {
      const y = yOf(r.L, 0.85);
      if (!visible(y)) continue;
      const x = xWrap(r.x, motion ? r.speed : 0, 0.1);
      ctx.save(); ctx.translate(x, y); ctx.rotate(r.rot + time * 0.3);
      ctx.fillStyle = "#8a7f74"; ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU, rr = r.r * (0.7 + ((k * 37) % 5) / 10); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.r * 0.2, r.r * 0.2, r.r * 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawISS(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 0.2) * 0.05);
    ctx.fillStyle = "#c9cfd8"; ctx.fillRect(-26, -2, 52, 4); ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = "#c8a24a";
    for (const sx of [-34, -22, 14, 26]) { ctx.fillRect(sx, -22, 8, 18); ctx.fillRect(sx, 4, 8, 18); }
    ctx.fillStyle = "#e9eef5"; ctx.fillRect(-2, -14, 4, 28);
    ctx.restore();
  }

  function drawMilestones() {
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    ctx.textBaseline = "bottom";
    for (const [alt, name, color, size, kind] of MILESTONES) {
      const y = yOf(toL(alt));
      if (!visible(y, 220)) continue;
      const cx = W * 0.72;
      if (kind === "iss") drawISS(cx + Math.sin(time * 0.15) * 30, y - 30);
      if (kind === "voyager") {
        ctx.fillStyle = "#d8dde5"; ctx.fillRect(cx - 4, y - 34, 8, 6);
        ctx.strokeStyle = "#d8dde5"; ctx.beginPath(); ctx.arc(cx, y - 40, 9, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, y - 28); ctx.lineTo(cx + 24, y - 20); ctx.stroke();
      }
      if (kind === "galaxy") { const s = Math.min(W, H) * 0.7; ctx.save(); ctx.translate(cx, y - 40); ctx.rotate(-0.4 + time * 0.01); ctx.drawImage(galaxySprite, -s / 2, -s / 2, s, s); ctx.restore(); }
      if (color) {
        const r = Math.max(10, Math.min(W, H) * size);
        ctx.save();
        if (kind === "sun") {
          const halo = ctx.createRadialGradient(cx, y, r * 0.6, cx, y, r * 3);
          halo.addColorStop(0, "rgba(255,210,100,0.6)"); halo.addColorStop(1, "rgba(255,150,50,0)");
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, y, r * 3, 0, TAU); ctx.fill();
        }
        const g = ctx.createRadialGradient(cx - r * 0.35, y - r * 0.35, r * 0.1, cx, y, r);
        g.addColorStop(0, kind === "sun" ? "#fffbe8" : "#ffffff"); g.addColorStop(0.3, color); g.addColorStop(1, kind === "sun" ? "#ff9a2a" : "rgba(0,0,0,0.75)");
        ctx.shadowColor = color; ctx.shadowBlur = kind === "sun" ? 70 : 18;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        if (kind === "moon") {
          ctx.fillStyle = "rgba(90,90,95,0.35)";
          const cr = rng(3);
          for (let i = 0; i < 12; i++) { const a = cr() * TAU, d = cr() * r * 0.75; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.05 + cr() * 0.12), 0, TAU); ctx.fill(); }
        }
        if (kind === "jupiter") {
          ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.clip();
          for (let i = -4; i <= 4; i++) { ctx.fillStyle = i % 2 ? "rgba(150,95,60,0.35)" : "rgba(255,240,220,0.25)"; ctx.fillRect(cx - r, y + i * r * 0.2, r * 2, r * 0.12); }
          ctx.fillStyle = "rgba(190,80,50,0.6)"; ctx.beginPath(); ctx.ellipse(cx + r * 0.3, y + r * 0.35, r * 0.18, r * 0.1, 0, 0, TAU); ctx.fill();
        }
        if (kind === "saturn") {
          ctx.strokeStyle = "rgba(230,210,160,0.8)"; ctx.lineWidth = r * 0.18;
          ctx.beginPath(); ctx.ellipse(cx, y, r * 2, r * 0.5, -0.25, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
      if (alt === 0) continue;
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(W - 70, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(fmtAlt(alt) + " · " + name, 14, y - 4);
    }
  }

  function drawPlane(L) {
    const x = planeX() + Math.sin(time * 37) * shake * 6;
    const y = planeY() + Math.sin(time * 1.3) * 4 + Math.cos(time * 41) * shake * 4;
    const climbing = clamp01((targetL - curL) * 3);
    const pitch = -0.18 - climbing * 0.32 + shake * 0.2 * Math.sin(time * 25);
    const s = W < 700 ? 0.8 : 1;
    const inSpace = L > 5;

    // traînée de condensation
    if (motion) trail.push({ x: x - 40 * s, y: y + 8 * s, a: 1 });
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      p.x -= 2.2; p.y += 1.2 + climbing * 5; p.a -= 0.012;
      if (p.a <= 0) { trail.splice(i, 1); continue; }
      ctx.fillStyle = inSpace ? `rgba(140,200,255,${p.a * 0.35})` : `rgba(255,255,255,${p.a * 0.45})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (1 - p.a) * 9, 0, TAU); ctx.fill();
    }
    if (trail.length > 140) trail.splice(0, trail.length - 140);

    // lignes de vitesse pendant la montée
    if (climbing > 0.15) {
      ctx.strokeStyle = `rgba(255,255,255,${0.25 * climbing})`; ctx.lineWidth = 1.5;
      const r = rng(Math.floor(time * 20));
      for (let i = 0; i < 14; i++) {
        const lx = r() * W, ly = r() * H, len = 30 + r() * 80;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - len * 0.4, ly + len); ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(x, y); ctx.rotate(pitch); ctx.scale(s, s);
    // flamme du réacteur
    const flame = 0.35 + climbing * 0.65 + glow * 0.5;
    const fl = 14 + flame * 26 + Math.sin(time * 40) * 3;
    const fg0 = ctx.createLinearGradient(-6, 16, -6 - fl, 16);
    fg0.addColorStop(0, inSpace ? "rgba(160,220,255,0.95)" : "rgba(255,240,190,0.9)"); fg0.addColorStop(1, inSpace ? "rgba(80,140,255,0)" : "rgba(255,140,40,0)");
    ctx.fillStyle = fg0; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(-6 - fl, 16); ctx.lineTo(-6, 20); ctx.fill();
    if (glow > 0) {
      ctx.save(); ctx.globalAlpha = glow * 0.8;
      const g = ctx.createRadialGradient(-50, 4, 0, -50, 4, 60);
      g.addColorStop(0, "#fff3c4"); g.addColorStop(0.4, "#ffb547"); g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-50, 4, 60, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = "#b9c6d6";
    ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(-22, -30); ctx.lineTo(-12, -30); ctx.lineTo(22, -2); ctx.closePath(); ctx.fill();
    const fg = ctx.createLinearGradient(0, -12, 0, 12);
    fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.55, "#e6ecf3"); fg.addColorStop(1, "#aebccd");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-58, -6); ctx.quadraticCurveTo(-60, -11, -50, -11);
    ctx.lineTo(40, -10); ctx.quadraticCurveTo(66, -8, 70, 1); ctx.quadraticCurveTo(64, 10, 40, 10);
    ctx.lineTo(-48, 9); ctx.quadraticCurveTo(-58, 8, -58, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(-46, -9, 84, 1.5); // reflet
    ctx.fillStyle = "#ffb547"; ctx.fillRect(-50, 2, 92, 3);
    ctx.fillStyle = "#1d2c44";
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-34 + i * 8, -3, 1.7, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(50, -7); ctx.quadraticCurveTo(62, -6, 64, -1); ctx.lineTo(52, -1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(160,210,255,0.6)"; ctx.fillRect(53, -6, 6, 1.5);
    ctx.fillStyle = "#e9eef5";
    ctx.beginPath(); ctx.moveTo(-40, -10); ctx.lineTo(-58, -36); ctx.lineTo(-46, -36); ctx.lineTo(-22, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffb547";
    ctx.beginPath(); ctx.moveTo(-52, -27); ctx.lineTo(-58, -36); ctx.lineTo(-46, -36); ctx.lineTo(-41, -27); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c9d4e2";
    ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-62, 10); ctx.lineTo(-54, 10); ctx.lineTo(-32, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#dfe6ef";
    ctx.beginPath(); ctx.moveTo(10, 3); ctx.lineTo(-18, 34); ctx.lineTo(-6, 34); ctx.lineTo(30, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8d9bb0"; ctx.beginPath(); ctx.ellipse(4, 16, 11, 4.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#2a3446"; ctx.beginPath(); ctx.ellipse(14, 16, 2, 4, 0, 0, TAU); ctx.fill();
    // feux de navigation
    const strobe = (time % 1.2) < 0.08, beacon = (time % 1.6) < 0.5;
    const light = (lx, ly, col, on, r) => { if (!on) return; const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill(); };
    light(-14, 34, "rgba(80,255,120,0.95)", true, 6);
    light(-17, -30, "rgba(255,70,70,0.9)", true, 5);
    light(-56, -36, "rgba(255,255,255,1)", strobe, 14);
    light(0, -12, "rgba(255,60,60,0.95)", beacon, 7);
    ctx.restore();
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.smoke ? 2 - p.life : 1), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function burst(good, strength) {
    const x = planeX(), y = planeY();
    const n = good ? 24 + Math.round(strength * 40) : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = good ? 1 + Math.random() * 4 : 0.5 + Math.random() * 1.2;
      particles.push(good
        ? { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.03, life: 1, decay: 0.015 + Math.random() * 0.015, r: 1.5 + Math.random() * 2.5, c: Math.random() > 0.4 ? "#ffd27a" : "#ffffff" }
        : { x: x - 20, y, vx: -1 - Math.random() * 1.5, vy: Math.sin(a) * v, g: -0.01, life: 1, decay: 0.012, r: 5 + Math.random() * 6, c: "rgba(70,74,82,0.7)", smoke: true });
    }
  }

  function drawOverlay() {
    // vignette + grain de pellicule
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,8,20,0.35)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (noisePattern) {
      ctx.save();
      const ox = motion ? Math.floor(Math.random() * 160) : 0, oy = motion ? Math.floor(Math.random() * 160) : 0;
      ctx.translate(-ox, -oy); ctx.globalAlpha = 0.5; ctx.fillStyle = noisePattern; ctx.fillRect(ox, oy, W + 160, H + 160);
      ctx.restore();
    }
  }

  function drawTape() {
    const w = W < 520 ? 52 : 64;
    const x = W - w - 6;
    const cy = planeY();
    const top = 64, bottom = H - 8;
    ctx.save();
    ctx.fillStyle = "rgba(8,17,31,0.55)";
    ctx.fillRect(x, top, w, bottom - top);
    ctx.beginPath(); ctx.rect(x, top, w, bottom - top); ctx.clip();
    ctx.font = "600 10px 'IBM Plex Mono', monospace";
    ctx.textBaseline = "middle"; ctx.textAlign = "right";
    const k = K();
    const Lmin = curL - (bottom - cy) / k, Lmax = curL + (cy - top) / k;
    const dmin = Math.floor(Math.log10(Math.max(1, fromL(Lmin)))) - 1;
    const dmax = Math.ceil(Math.log10(Math.max(10, fromL(Lmax)))) + 1;
    for (let d = Math.max(0, dmin); d <= dmax; d++) {
      for (const m of [1, 2, 5]) {
        const alt = m * Math.pow(10, d), y = yOf(toL(alt));
        if (y < top - 10 || y > bottom + 10) continue;
        ctx.strokeStyle = "rgba(234,242,251,0.6)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (m === 1 ? 12 : 7), y); ctx.stroke();
        ctx.fillStyle = m === 1 ? "rgba(234,242,251,0.95)" : "rgba(234,242,251,0.6)";
        ctx.fillText(fmtShort(alt), x + w - 6, y);
      }
    }
    const y0 = yOf(L0);
    if (y0 < bottom) { ctx.fillStyle = "rgba(91,227,161,0.25)"; ctx.fillRect(x, y0, w, bottom - y0); }
    ctx.restore();
    ctx.fillStyle = "#08111f"; ctx.strokeStyle = "#ffb547"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, cy); ctx.lineTo(x, cy - 12); ctx.lineTo(x + w, cy - 12); ctx.lineTo(x + w, cy + 12); ctx.lineTo(x, cy + 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffb547"; ctx.font = "600 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(fmtShort(fromL(curL)), x + w - 6, cy + 1);
    ctx.textAlign = "left";
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (motion) time += dt;
    const ease = motion ? Math.min(1, dt * 1.8) : 1;
    curL += (targetL - curL) * ease;
    if (Math.abs(targetL - curL) < 0.0005) curL = targetL;
    shake = Math.max(0, shake - dt * 1.8);
    glow = Math.max(0, glow - dt * 0.9);

    const [top, bot] = skyColors(curL);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    drawStars(curL);
    drawNebulae(curL);
    drawSun(curL);
    drawEarthCurve(curL);
    drawGround();
    drawClouds(false);
    drawJets();
    drawBalloons();
    drawBirds();
    drawUpperAtmosphere(curL);
    drawMeteors(curL);
    drawSatellites();
    drawRocks();
    drawMilestones();
    drawPlane(curL);
    drawParticles();
    drawClouds(true);
    drawOverlay();
    drawTape();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Sky = {
    setAltitude(m, instant) { targetL = toL(m); if (instant || !motion) curL = targetL; },
    good(strength) { glow = Math.min(1, 0.4 + strength); burst(true, strength); },
    bad() { shake = 1; burst(false, 0); },
    setMotion(on) { motion = !!on; },
    displayed() { return fromL(curL); }
  };
  window.Alt = { fmt: fmtAlt, layerOf, nextMilestone, MILESTONES };
})();
