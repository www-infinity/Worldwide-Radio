/**
 * Worldwide Radio – Hero Canvas Animation
 *
 * Draws a Flux-Capacitor-inspired energy field:
 *   • Rotating plasma rings
 *   • Radiating signal-wave arcs
 *   • Particle field (floating signal nodes)
 *   • Scan-line sweep overlay
 *
 * Designed to mirror the aesthetic of www-infinity/Flux-Capacitor
 * (nested coils, gallium-glow, distributed thermal transfer) and
 * www-infinity/Infinity-Graphics (canvas / WebGL rendering engine).
 */

(() => {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W, H, cx, cy, raf;

  // ── Colour palette ────────────────────────────────────────────────────────
  const CYAN   = "#00d4ff";
  const GOLD   = "#ffd166";
  const PURPLE = "#7b5cfa";
  const WHITE  = "rgba(255,255,255,0.85)";

  // ── State ─────────────────────────────────────────────────────────────────
  let tick = 0;
  let particles = [];
  let scanY = 0;

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    cx = W / 2;
    cy = H / 2;
    buildParticles();
  }

  // ── Particles (floating signal nodes) ────────────────────────────────────
  function buildParticles() {
    const count = Math.min(120, Math.floor((W * H) / 8000));
    particles = Array.from({ length: count }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  0.8 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      hue: Math.random() < 0.5 ? CYAN : (Math.random() < 0.5 ? GOLD : PURPLE),
      alpha: 0.3 + Math.random() * 0.6,
    }));
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.fillStyle = p.hue;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // ── Plasma rings (Flux Capacitor coil rings) ───────────────────────────────
  function drawPlasmaRings() {
    const maxR  = Math.min(W, H) * 0.44;
    const rings = 5;
    for (let i = 0; i < rings; i++) {
      const phase = (tick * 0.008) + (i * Math.PI * 2) / rings;
      const r     = maxR * ((i + 1) / rings);
      const alpha = 0.06 + 0.06 * Math.sin(phase * 2);

      // Outer glow
      const grad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r);
      if (i % 3 === 0) {
        grad.addColorStop(0, `rgba(0,212,255,0)`);
        grad.addColorStop(1, `rgba(0,212,255,${alpha})`);
      } else if (i % 3 === 1) {
        grad.addColorStop(0, `rgba(123,92,250,0)`);
        grad.addColorStop(1, `rgba(123,92,250,${alpha})`);
      } else {
        grad.addColorStop(0, `rgba(255,209,102,0)`);
        grad.addColorStop(1, `rgba(255,209,102,${alpha})`);
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ── Rotating inner coil (tight-wound primary, Flux Capacitor §Nested String)
  function drawCoil() {
    const spokes = 12;
    const innerR = Math.min(W, H) * 0.06;
    const outerR = Math.min(W, H) * 0.18;
    const angle0 = tick * 0.012;

    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < spokes; i++) {
      const a   = angle0 + (i / spokes) * Math.PI * 2;
      const x1  = Math.cos(a) * innerR;
      const y1  = Math.sin(a) * innerR;
      const x2  = Math.cos(a) * outerR;
      const y2  = Math.sin(a) * outerR;
      const alpha = 0.25 + 0.2 * Math.sin(tick * 0.05 + i);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Radiating signal arcs ─────────────────────────────────────────────────
  function drawSignalArcs() {
    const maxWaves = 4;
    const speed = 1.2;
    const maxR   = Math.min(W, H) * 0.48;

    for (let w = 0; w < maxWaves; w++) {
      const progress = ((tick * speed + w * (maxR / maxWaves)) % maxR) / maxR;
      const r = progress * maxR;
      const alpha = (1 - progress) * 0.25;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ── Scan-line sweep ───────────────────────────────────────────────────────
  function drawScanLine() {
    scanY = (scanY + 0.8) % H;
    const grad = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
    grad.addColorStop(0, "rgba(0,212,255,0)");
    grad.addColorStop(0.5, "rgba(0,212,255,0.08)");
    grad.addColorStop(1, "rgba(0,212,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 6, W, 12);
  }

  // ── Dark vignette so content above is readable ────────────────────────────
  function drawVignette() {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    grad.addColorStop(0, "rgba(13,15,20,0)");
    grad.addColorStop(1, "rgba(13,15,20,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Centre glyph (∞ symbol) ───────────────────────────────────────────────
  function drawInfinityGlyph() {
    const s = 0.95 + 0.05 * Math.sin(tick * 0.04);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.font = `bold ${Math.min(W, H) * 0.08}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.07 + 0.03 * Math.sin(tick * 0.03);
    ctx.fillStyle = CYAN;
    ctx.fillText("∞", 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Main render loop ──────────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, W, H);

    drawPlasmaRings();
    drawSignalArcs();
    drawCoil();
    drawParticles();
    drawInfinityGlyph();
    drawScanLine();
    drawVignette();

    updateParticles();
    tick++;
    raf = requestAnimationFrame(render);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  window.addEventListener("resize", resize);
  resize();
  render();

  // Pause animation when tab is not visible (save CPU/battery)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      tick = 0;
      render();
    }
  });
})();
