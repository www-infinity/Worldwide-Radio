/**
 * User Profile — localStorage-based identity & history
 *
 * Stores locally in the browser (no server, no passwords):
 *   • Display name + avatar colour
 *   • Scan history  (last 50 stations played)
 *   • Crusher history (last 20 Bitcoin Crusher spins)
 *   • AI chat history (last 100 messages)
 *   • Preferences (volume, dwell)
 *
 * Nothing sensitive is stored. This is a convenience layer, not real auth.
 * Render helpers are also exported so index.html can call them directly.
 */
const UserProfile = (() => {
  const KEY = "www_infinity_profile_v1";

  const AVATAR_COLOURS = [
    "#00d4ff", "#7b5cfa", "#ffd166", "#ff4757",
    "#06d6a0", "#ef476f", "#118ab2", "#8338ec",
  ];

  // ── Schema ─────────────────────────────────────────────────────────────────

  function blank() {
    return {
      name:         "",
      avatarColour: AVATAR_COLOURS[Math.floor(Math.random() * AVATAR_COLOURS.length)],
      createdAt:    Date.now(),
      scanHistory:  [],   // [{ts, name, country, tags}]
      crushHistory: [],   // [{ts, height, hash, channel, emoji, index}]
      chatHistory:  [],   // [{role, content, ts}]
      prefs:        { volume: 80, dwell: 6 },
    };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
    } catch (_) {
      return blank();
    }
  }

  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) {}
  }

  // ── Getters / setters ──────────────────────────────────────────────────────

  function get()             { return load(); }

  function setName(name) {
    const p = load();
    p.name = String(name).trim().slice(0, 32);
    save(p);
    renderNavAvatar();
    return p;
  }

  function setAvatarColour(colour) {
    const p = load();
    p.avatarColour = colour;
    save(p);
    renderNavAvatar();
    return p;
  }

  function savePrefs(prefs) {
    const p = load();
    p.prefs = { ...p.prefs, ...prefs };
    save(p);
    return p;
  }

  // ── History logging ────────────────────────────────────────────────────────

  function logStation(station) {
    const p = load();
    p.scanHistory.unshift({
      ts:      Date.now(),
      name:    station.name || "Unknown",
      country: station.country || "",
      tags:    (station.tags || "").split(",").slice(0, 3).join(", "),
    });
    p.scanHistory = p.scanHistory.slice(0, 50);
    save(p);
  }

  function logCrush(result) {
    const p = load();
    p.crushHistory.unshift({
      ts:      Date.now(),
      height:  result.height,
      hash:    result.hash.slice(0, 16) + "…",
      channel: result.channel.label,
      emoji:   result.channel.emoji,
      index:   result.index,
    });
    p.crushHistory = p.crushHistory.slice(0, 20);
    save(p);
  }

  function addChatMessage(role, content) {
    const p = load();
    p.chatHistory.push({ role, content, ts: Date.now() });
    p.chatHistory = p.chatHistory.slice(-100);
    save(p);
  }

  function clearHistory() {
    const p = load();
    p.scanHistory  = [];
    p.crushHistory = [];
    p.chatHistory  = [];
    save(p);
  }

  // ── UI render ──────────────────────────────────────────────────────────────

  /** Update the nav avatar button to reflect current profile */
  function renderNavAvatar() {
    const btn = document.getElementById("profileBtn");
    if (!btn) return;
    const p = load();
    const initial = p.name ? p.name[0].toUpperCase() : "∞";
    btn.style.background = p.avatarColour;
    btn.textContent      = initial;
    btn.title            = p.name ? `Profile: ${p.name}` : "Set your profile";
  }

  /** Populate the profile modal with current data */
  function renderModal() {
    const p = load();

    // Name input
    const nameInput = document.getElementById("profileNameInput");
    if (nameInput) nameInput.value = p.name;

    // Colour swatches
    const swatchWrap = document.getElementById("profileColourSwatches");
    if (swatchWrap) {
      swatchWrap.innerHTML = "";
      AVATAR_COLOURS.forEach((c) => {
        const sw = document.createElement("button");
        sw.className = "colour-swatch";
        sw.style.background = c;
        sw.setAttribute("aria-label", `Avatar colour ${c}`);
        if (c === p.avatarColour) sw.classList.add("selected");
        sw.addEventListener("click", () => {
          setAvatarColour(c);
          swatchWrap.querySelectorAll(".colour-swatch").forEach((s) =>
            s.classList.remove("selected")
          );
          sw.classList.add("selected");
        });
        swatchWrap.appendChild(sw);
      });
    }

    // Scan history
    const scanList = document.getElementById("profileScanHistory");
    if (scanList) {
      scanList.innerHTML = p.scanHistory.length
        ? p.scanHistory.slice(0, 10)
            .map((s) => `<li>${escapeHtml(s.name)} <span class="hist-meta">${escapeHtml(s.country)}</span></li>`)
            .join("")
        : '<li class="hist-empty">No stations played yet.</li>';
    }

    // Crusher history
    const crushList = document.getElementById("profileCrushHistory");
    if (crushList) {
      crushList.innerHTML = p.crushHistory.length
        ? p.crushHistory.slice(0, 5)
            .map((c) => `<li>${c.emoji} ${escapeHtml(c.channel)} <span class="hist-meta">#${c.height}</span></li>`)
            .join("")
        : '<li class="hist-empty">No crusher spins yet.</li>';
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return {
    get, setName, setAvatarColour, savePrefs,
    logStation, logCrush, addChatMessage, clearHistory,
    renderNavAvatar, renderModal, AVATAR_COLOURS,
  };
})();
