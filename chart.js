// Courbes animées : trajectoire de montée après une réponse, et profil du vol complet.
(function () {
  const TAU = Math.PI * 2;
  const TIER_COLORS = ["#9fb3c8", "#7fb2ff", "#ffcf5a", "#ffb547", "#5be3a1"];
  const BAD = "#ff7a6b";
  const reduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const running = new WeakMap();

  function setup(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 150;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function animate(canvas, duration, draw) {
    const prev = running.get(canvas); if (prev) cancelAnimationFrame(prev);
    if (reduce()) { draw(1); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      draw(p);
      if (p < 1) running.set(canvas, requestAnimationFrame(step)); else running.delete(canvas);
    };
    running.set(canvas, requestAnimationFrame(step));
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function miniPlane(ctx, x, y, angle, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(s, s);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(10, -3); ctx.quadraticCurveTo(17, -2, 18, 0); ctx.quadraticCurveTo(17, 2, 10, 3); ctx.lineTo(-14, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(-5, 10); ctx.lineTo(-1, 10); ctx.lineTo(7, 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-15, -9); ctx.lineTo(-12, -9); ctx.lineTo(-6, -2); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(-12, 0, 22, 1.2);
    ctx.restore();
  }
  function fmtM(m) {
    if (m < 100000) return Math.round(m).toLocaleString("fr-FR") + " m";
    return window.Alt ? Alt.fmt(m) : Math.round(m / 1000) + " km";
  }
  function niceStep(max) {
    const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
    return 10 * p;
  }

  // Trajectoire après une réponse.
  // opts : { gain, max, low, tier (0-4) ou -1 si refusée, onCount(valeur) }
  function climb(canvas, opts) {
    const { ctx, w, h } = setup(canvas);
    const padL = 12, padR = 64, padT = 16, padB = 22;
    const x0 = padL, x1 = w - padR - 22, yB = h - padB, yT = padT;
    const max = opts.max;
    const yOf = (m) => yB - (m / max) * (yB - yT);
    const good = opts.tier >= 0;
    const color = good ? TIER_COLORS[opts.tier] : BAD;
    const RUNWAY = 0.14;
    // altitude le long de la trajectoire (t de 0 à 1)
    const path = (t, target) => {
      if (t < RUNWAY) return 0;
      const u = (t - RUNWAY) / (1 - RUNWAY);
      if (good) return target * smooth(u);
      // décrochage : l'avion tente de monter puis retombe
      return max * 0.22 * Math.sin(Math.min(1, u * 1.05) * Math.PI) * (1 - u * 0.15);
    };
    const step = niceStep(max);

    function base() {
      ctx.clearRect(0, 0, w, h);
      ctx.font = "600 10px 'IBM Plex Mono', monospace";
      ctx.textBaseline = "middle";
      for (let m = 0; m <= max + 1; m += step) {
        const y = yOf(m);
        ctx.strokeStyle = "rgba(196,220,255,0.10)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 + 22, y); ctx.stroke();
        ctx.fillStyle = "rgba(159,179,200,0.8)"; ctx.textAlign = "left";
        ctx.fillText(fmtM(m), x1 + 30, y);
      }
      // courbes de référence
      const ref = (target, label) => {
        const y = yOf(target);
        ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(196,220,255,0.3)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 + 22, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(196,220,255,0.6)"; ctx.textAlign = "left";
        ctx.fillText(label, x0 + 4, y - 8 < yT ? y + 9 : y - 8);
      };
      if (good) { ref(max, "pépite maximale"); if (opts.low < max * 0.85) ref(opts.low, "réponse la plus citée"); }
      // piste
      ctx.fillStyle = "#3a3f47"; ctx.fillRect(x0, yB, (x1 - x0) * RUNWAY + 10, 4);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let x = x0 + 4; x < x0 + (x1 - x0) * RUNWAY; x += 12) ctx.fillRect(x, yB + 1.5, 6, 1);
    }

    animate(canvas, good ? 1500 + opts.tier * 150 : 1500, (p) => {
      base();
      const head = easeOut(p);
      const N = 90, pts = [];
      for (let i = 0; i <= N * head; i++) {
        const t = i / N;
        pts.push([x0 + t * (x1 - x0), yOf(path(t, opts.gain))]);
      }
      const t = head, hx = x0 + t * (x1 - x0), hy = yOf(path(t, opts.gain));
      pts.push([hx, hy]);
      // aire sous la courbe
      const grad = ctx.createLinearGradient(0, yT, 0, yB);
      grad.addColorStop(0, color + "66"); grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(pts[0][0], yB);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(hx, yB); ctx.closePath(); ctx.fill();
      // traînée
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.shadowBlur = 0;
      // avion orienté selon la pente
      const dt = 0.01, ny = yOf(path(Math.min(1, t + dt), opts.gain)), py = yOf(path(Math.max(0, t - dt), opts.gain));
      let angle = Math.atan2(ny - py, 2 * dt * (x1 - x0));
      if (!good && p > 0.8) angle += Math.sin(p * 40) * 0.15;
      miniPlane(ctx, hx, hy, angle, 1.1, color);
      // altitude atteinte
      const shown = good ? opts.gain * smooth(Math.min(1, Math.max(0, (head - RUNWAY) / (1 - RUNWAY)))) : 0;
      if (good) {
        ctx.font = "600 13px 'IBM Plex Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = color;
        const label = "+" + fmtM(shown);
        const lw = ctx.measureText(label).width;
        const lx = hx + 16 + lw < x1 + 20 ? hx + 16 : hx - 18 - lw;
        const ly = hy - 16 < yT + 4 ? hy + 16 : hy - 16;
        ctx.fillStyle = "rgba(8,17,31,0.75)"; ctx.fillRect(lx - 4, ly - 9, lw + 8, 18);
        ctx.fillStyle = color; ctx.fillText(label, lx, ly);
      } else if (p > 0.6) {
        ctx.font = "600 12px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = BAD;
        ctx.fillText("décrochage", (x0 + x1) / 2, yT + 8);
      }
      if (opts.onCount) opts.onCount(shown, p);
    });
  }

  // Profil du vol complet : altitude cumulée question par question.
  // picks : [{ gain, tier }] (tier -1 = refusée)
  function flight(canvas, picks) {
    const { ctx, w, h } = setup(canvas);
    const padL = 12, padR = 70, padT = 18, padB = 24;
    const x0 = padL, x1 = w - padR - 20, yB = h - padB, yT = padT;
    const cum = [0]; picks.forEach((p) => cum.push(cum[cum.length - 1] + p.gain));
    const total = cum[cum.length - 1];
    const max = Math.max(total, 1000) * 1.08;
    const n = picks.length;
    const xOf = (i) => x0 + (i / Math.max(1, n)) * (x1 - x0);
    const yOf = (m) => yB - (m / max) * (yB - yT);
    const step = niceStep(max);

    animate(canvas, 1200 + n * 120, (p) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.textBaseline = "middle";
      for (let m = 0; m <= max; m += step) {
        const y = yOf(m);
        ctx.strokeStyle = "rgba(196,220,255,0.10)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 + 22, y); ctx.stroke();
        ctx.fillStyle = "rgba(159,179,200,0.8)"; ctx.textAlign = "left"; ctx.fillText(fmtM(m), x1 + 28, y);
      }
      ctx.textAlign = "center";
      if (n <= 20) for (let i = 1; i <= n; i++) { ctx.fillStyle = "rgba(159,179,200,0.7)"; ctx.fillText(String(i), xOf(i), yB + 12); }
      const head = easeOut(p) * n;
      // segments lissés entre chaque question
      const seg = (i, u) => [xOf(i - 1 + u), yOf(cum[i - 1] + (cum[i] - cum[i - 1]) * smooth(u))];
      const pts = [[xOf(0), yOf(0)]];
      for (let i = 1; i <= n; i++) {
        const lim = Math.min(1, head - (i - 1));
        if (lim <= 0) break;
        for (let k = 1; k <= 16; k++) { const u = (k / 16) * lim; pts.push(seg(i, u)); }
      }
      const last = pts[pts.length - 1];
      const grad = ctx.createLinearGradient(0, yT, 0, yB);
      grad.addColorStop(0, "rgba(255,181,71,0.45)"); grad.addColorStop(1, "rgba(255,181,71,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(pts[0][0], yB); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(last[0], yB); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ffb547"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      // points par question, colorés selon la rareté
      for (let i = 1; i <= n && i <= head + 0.001; i++) {
        const c = picks[i - 1].tier >= 0 ? TIER_COLORS[picks[i - 1].tier] : BAD;
        ctx.fillStyle = "#08111f"; ctx.beginPath(); ctx.arc(xOf(i), yOf(cum[i]), 5, 0, TAU); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(xOf(i), yOf(cum[i]), 3.5, 0, TAU); ctx.fill();
      }
      if (pts.length > 1) {
        const [ax, ay] = pts[Math.max(0, pts.length - 3)];
        miniPlane(ctx, last[0], last[1], Math.atan2(last[1] - ay, Math.max(1, last[0] - ax)), 1.1, "#ffb547");
      }
    });
  }

  window.Charts = { climb, flight, TIER_COLORS };
})();
