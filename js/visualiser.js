/**
 * Audio Visualiser — Frequency Bar Display
 *
 * Hooks into the HTML <audio> element via the Web Audio API to render a
 * real-time frequency-bar visualiser on a <canvas> element.
 *
 * Usage:
 *   Visualiser.init(audioElement, canvasElement);
 *   Visualiser.start();  // called when audio begins playing
 *   Visualiser.stop();   // called when audio pauses / stops
 */

const Visualiser = (() => {
  let audioCtx    = null;
  let analyser    = null;
  let source      = null;
  let rafId       = null;
  let canvas      = null;
  let ctx         = null;
  let dataArray   = null;
  let bufferLen   = 0;
  let running     = false;

  // Visual config
  const BAR_COUNT  = 64;
  const BAR_GAP    = 2;
  const FFT_SIZE   = 256; // produces 128 usable frequency bins (bufferLen = fftSize / 2)
  const CYAN       = "#00d4ff";
  const GOLD       = "#ffd166";
  const PURPLE     = "#7b5cfa";

  /** Lazily create the AudioContext (must be after user gesture on most browsers). */
  function ensureContext(audioEl) {
    if (audioCtx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const newCtx      = new AC();
      const newAnalyser = newCtx.createAnalyser();
      newAnalyser.fftSize               = FFT_SIZE;
      newAnalyser.smoothingTimeConstant = 0.8;
      const newSource = newCtx.createMediaElementSource(audioEl);
      newSource.connect(newAnalyser);
      newAnalyser.connect(newCtx.destination);
      // All steps succeeded — commit to module-level state
      audioCtx  = newCtx;
      analyser  = newAnalyser;
      source    = newSource;
      bufferLen = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLen);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Initialise the visualiser.
   * @param {HTMLAudioElement} audioEl
   * @param {HTMLCanvasElement} canvasEl
   */
  function init(audioEl, canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext("2d");

    // Resize canvas to match CSS size
    function resize() {
      canvas.width  = canvas.offsetWidth  * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    window.addEventListener("resize", resize);
    resize();

    // Auto-wire to audio element events
    audioEl.addEventListener("playing", async () => {
      if (ensureContext(audioEl)) {
        if (audioCtx.state === "suspended") await audioCtx.resume().catch(() => {});
        start();
      }
    });
    audioEl.addEventListener("pause",  stop);
    audioEl.addEventListener("ended",  stop);
    audioEl.addEventListener("error",  stop);
  }

  /** Start the render loop. */
  function start() {
    if (running) return;
    running = true;
    draw();
  }

  /** Stop the render loop and clear the canvas. */
  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    }
  }

  function draw() {
    if (!running) return;
    rafId = requestAnimationFrame(draw);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    ctx.clearRect(0, 0, W, H);

    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    // How many bars to actually draw (use first half of spectrum — more interesting)
    const bars     = Math.min(BAR_COUNT, bufferLen);
    const barW     = (W - BAR_GAP * (bars - 1)) / bars;

    for (let i = 0; i < bars; i++) {
      // Normalise: dataArray values 0–255
      const raw    = dataArray[i];
      const ratio  = raw / 255;
      const barH   = ratio * H;
      const x      = i * (barW + BAR_GAP);
      const y      = H - barH;

      // Gradient colour: cyan (low) → gold (mid) → purple (high)
      let colour;
      if (ratio < 0.4) {
        colour = CYAN;
      } else if (ratio < 0.75) {
        colour = GOLD;
      } else {
        colour = PURPLE;
      }

      // Glow effect
      ctx.shadowBlur  = 6;
      ctx.shadowColor = colour;

      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.6 + ratio * 0.4;
      ctx.fillRect(x, y, barW, barH);
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  return { init, start, stop };
})();

// CommonJS compat for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = Visualiser;
}
