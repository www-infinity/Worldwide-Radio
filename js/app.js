/**
 * Worldwide Radio Scanner – Main Application
 *
 * Orchestrates station fetching, scanning, and audio playback.
 * Depends on: js/radioBrowser.js (must be loaded first)
 */

(() => {
  // ── State ─────────────────────────────────────────────────────────────────
  let stations = [];          // current station list
  let currentIndex = 0;       // index in stations array being played
  let scanTimer = null;       // setInterval handle while scanning
  let isScanning = false;
  let isPlaying = false;
  let scanDwell = 6;          // seconds per station while scanning

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const audioEl        = document.getElementById("audioPlayer");
  const loadingEl      = document.getElementById("loading");
  const errorEl        = document.getElementById("errorMsg");
  const stationListEl  = document.getElementById("stationList");
  const nowPlayingEl   = document.getElementById("nowPlaying");
  const stationNameEl  = document.getElementById("stationName");
  const stationTagsEl  = document.getElementById("stationTags");
  const stationCountEl = document.getElementById("stationCountry");
  const stationBitrateEl = document.getElementById("stationBitrate");
  const scanBtn        = document.getElementById("btnScan");
  const prevBtn        = document.getElementById("btnPrev");
  const nextBtn        = document.getElementById("btnNext");
  const stopBtn        = document.getElementById("btnStop");
  const searchBtn      = document.getElementById("btnSearch");
  const queryInput     = document.getElementById("searchQuery");
  const countrySelect  = document.getElementById("countrySelect");
  const tagSelect      = document.getElementById("tagSelect");
  const dwellRange     = document.getElementById("dwellTime");
  const dwellLabel     = document.getElementById("dwellLabel");
  const volumeRange    = document.getElementById("volume");
  const resultCount    = document.getElementById("resultCount");
  const signalBar      = document.getElementById("signalBar");

  // Bitcoin Crusher DOM refs
  const crushBtn       = document.getElementById("btnCrush");
  const slotEmoji      = document.getElementById("slotEmoji");
  const slotLabel      = document.getElementById("slotLabel");
  const crusherMeta    = document.getElementById("crusherMeta");
  const crusherHeight  = document.getElementById("crusherHeight");
  const crusherHash    = document.getElementById("crusherHash");
  const crusherIndex   = document.getElementById("crusherIndex");
  const crusherHint    = document.getElementById("crusherHint");
  const crusherError   = document.getElementById("crusherError");

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    dwellRange.value = scanDwell;
    dwellLabel.textContent = `${scanDwell}s`;
    volumeRange.value = audioEl.volume * 100;

    await loadCountries();
    await loadTopStations();
    setupEventListeners();
  }

  async function loadCountries() {
    try {
      const countries = await RadioBrowser.getCountries();
      countries.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.iso_3166_1;
        opt.textContent = `${c.name} (${c.stationcount})`;
        countrySelect.appendChild(opt);
      });
    } catch (e) {
      console.warn("Could not load country list:", e);
    }
  }

  async function loadTopStations() {
    showLoading(true);
    clearError();
    try {
      stations = await RadioBrowser.getTopStations(200);
      renderStationList();
    } catch (e) {
      showError("Could not load stations. Check your connection and try again.");
    } finally {
      showLoading(false);
    }
  }

  // ── Event Listeners ───────────────────────────────────────────────────────
  function setupEventListeners() {
    searchBtn.addEventListener("click", handleSearch);
    queryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });

    countrySelect.addEventListener("change", handleCountryChange);
    tagSelect.addEventListener("change", handleTagChange);

    scanBtn.addEventListener("click", startScan);
    prevBtn.addEventListener("click", playPrev);
    nextBtn.addEventListener("click", playNext);
    stopBtn.addEventListener("click", stopAll);
    crushBtn.addEventListener("click", handleCrush);

    dwellRange.addEventListener("input", () => {
      scanDwell = parseInt(dwellRange.value, 10);
      dwellLabel.textContent = `${scanDwell}s`;
      // Restart scan timer if scanning so the new dwell takes effect
      if (isScanning) {
        clearInterval(scanTimer);
        scanTimer = setInterval(playNext, scanDwell * 1000);
      }
    });

    volumeRange.addEventListener("input", () => {
      audioEl.volume = volumeRange.value / 100;
    });

    audioEl.addEventListener("playing", () => {
      isPlaying = true;
      animateSignal(true);
    });
    audioEl.addEventListener("pause", () => {
      isPlaying = false;
      animateSignal(false);
    });
    audioEl.addEventListener("error", () => {
      // Station stream failed – skip to next when scanning, else show error
      if (isScanning) {
        playNext();
      } else {
        showError(`Stream error. The station may be offline. Try another.`);
        animateSignal(false);
      }
    });
  }

  // ── Search & Filter ───────────────────────────────────────────────────────
  async function handleSearch() {
    const query = queryInput.value.trim();
    if (!query) return;

    countrySelect.value = "";
    tagSelect.value = "";
    showLoading(true);
    clearError();
    stopAll();

    try {
      stations = await RadioBrowser.searchByName(query, 200);
      if (stations.length === 0) {
        showError(`No stations found for "${query}". Try a different search.`);
      }
      renderStationList();
    } catch (e) {
      showError("Search failed. Please try again.");
    } finally {
      showLoading(false);
    }
  }

  async function handleCountryChange() {
    const code = countrySelect.value;
    if (!code) return;

    queryInput.value = "";
    tagSelect.value = "";
    showLoading(true);
    clearError();
    stopAll();

    try {
      stations = await RadioBrowser.getStationsByCountry(code, 200);
      if (stations.length === 0) {
        showError("No stations found for that country.");
      }
      renderStationList();
    } catch (e) {
      showError("Could not load country stations. Please try again.");
    } finally {
      showLoading(false);
    }
  }

  async function handleTagChange() {
    const tag = tagSelect.value;
    if (!tag) return;

    queryInput.value = "";
    countrySelect.value = "";
    showLoading(true);
    clearError();
    stopAll();

    try {
      stations = await RadioBrowser.getStationsByTag(tag, 200);
      if (stations.length === 0) {
        showError("No stations found for that genre.");
      }
      renderStationList();
    } catch (e) {
      showError("Could not load genre stations. Please try again.");
    } finally {
      showLoading(false);
    }
  }

  // ── Playback ──────────────────────────────────────────────────────────────
  function playStation(index) {
    if (stations.length === 0) return;

    currentIndex = ((index % stations.length) + stations.length) % stations.length;
    const station = stations[currentIndex];

    if (!station.url_resolved && !station.url) {
      // No stream URL – skip
      playNext();
      return;
    }

    clearError();
    audioEl.src = station.url_resolved || station.url;
    audioEl.load();
    audioEl.play().catch(() => {
      // Autoplay blocked or stream error
      if (isScanning) playNext();
    });

    RadioBrowser.registerClick(station.stationuuid);
    updateNowPlaying(station);
    highlightListItem(currentIndex);
  }

  function playNext() {
    playStation(currentIndex + 1);
  }

  function playPrev() {
    playStation(currentIndex - 1);
  }

  function startScan() {
    if (stations.length === 0) {
      showError("Load stations first before scanning.");
      return;
    }
    isScanning = true;
    scanBtn.classList.add("active");
    scanBtn.textContent = "⚡ Scanning…";
    playStation(currentIndex);
    scanTimer = setInterval(playNext, scanDwell * 1000);
  }

  function stopAll() {
    isScanning = false;
    clearInterval(scanTimer);
    scanTimer = null;
    audioEl.pause();
    audioEl.src = "";
    scanBtn.classList.remove("active");
    scanBtn.textContent = "⚡ Scan";
    animateSignal(false);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function renderStationList() {
    stationListEl.innerHTML = "";
    resultCount.textContent = stations.length
      ? `${stations.length} station${stations.length !== 1 ? "s" : ""}`
      : "0 stations";

    stations.forEach((s, i) => {
      const li = document.createElement("li");
      li.className = "station-item";
      li.dataset.index = i;

      const favicon = s.favicon
        ? `<img class="favicon" src="${escapeHtml(s.favicon)}" alt="" onerror="this.style.display='none'">`
        : `<span class="favicon-placeholder">📻</span>`;

      li.innerHTML = `
        ${favicon}
        <div class="station-info">
          <span class="station-item-name">${escapeHtml(s.name || "Unknown")}</span>
          <span class="station-item-meta">${escapeHtml(s.country || "")}${s.tags ? " · " + escapeHtml(s.tags.split(",").slice(0, 3).join(", ")) : ""}</span>
        </div>
        <span class="station-codec">${escapeHtml(s.codec || "")}</span>
      `;

      li.addEventListener("click", () => {
        isScanning = false;
        clearInterval(scanTimer);
        scanTimer = null;
        scanBtn.classList.remove("active");
        scanBtn.textContent = "⚡ Scan";
        playStation(i);
      });

      stationListEl.appendChild(li);
    });
  }

  function highlightListItem(index) {
    document.querySelectorAll(".station-item").forEach((el) => el.classList.remove("playing"));
    const target = stationListEl.querySelector(`[data-index="${index}"]`);
    if (target) {
      target.classList.add("playing");
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function updateNowPlaying(station) {
    nowPlayingEl.hidden = false;
    stationNameEl.textContent = station.name || "Unknown Station";
    stationTagsEl.textContent = station.tags
      ? station.tags.split(",").slice(0, 5).join(" · ")
      : "—";
    stationCountEl.textContent = [station.country, station.state]
      .filter(Boolean)
      .join(", ") || "—";
    stationBitrateEl.textContent = station.bitrate ? `${station.bitrate} kbps` : "—";
  }

  function animateSignal(active) {
    if (active) {
      signalBar.classList.add("active");
    } else {
      signalBar.classList.remove("active");
    }
  }

  function showLoading(show) {
    loadingEl.hidden = !show;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);
})();
