/**
 * Radio Browser API Client
 * Uses the public Radio Browser API (https://api.radio-browser.info/)
 * No API key required – free, community-driven, CORS-enabled.
 *
 * Automatically tries multiple community mirrors if the primary server
 * is unreachable, so the scanner keeps working when any single node is down.
 *
 * To override the mirror list entirely, set
 *   window.RADIO_BROWSER_BASE_URL = "https://nl1.api.radio-browser.info/json"
 * before this script loads.
 */

const RadioBrowser = (() => {
  // Community mirrors in preference order.
  const MIRRORS = [
    "https://de1.api.radio-browser.info/json",
    "https://nl1.api.radio-browser.info/json",
    "https://at1.api.radio-browser.info/json",
    "https://fi1.api.radio-browser.info/json",
  ];

  // Index of the mirror currently in use (advances on failure).
  let mirrorIdx = 0;

  function baseUrl() {
    if (typeof window !== "undefined" && window.RADIO_BROWSER_BASE_URL) {
      return window.RADIO_BROWSER_BASE_URL;
    }
    return MIRRORS[mirrorIdx % MIRRORS.length];
  }

  /**
   * Perform a GET request against the Radio Browser API.
   * Automatically retries on the next mirror if the current one fails.
   * @param {string} path  – e.g. "/stations/bycountry/United States"
   * @param {Object} params – query-string parameters
   * @returns {Promise<Array>}
   */
  async function get(path, params = {}) {
    const tried = new Set();
    let lastError;

    for (let attempt = 0; attempt < MIRRORS.length; attempt++) {
      const base = baseUrl();
      if (tried.has(base)) { mirrorIdx++; continue; }
      tried.add(base);

      try {
        const url = new URL(base + path);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

        const response = await fetch(url.toString(), {
          headers: {
            "User-Agent": "WorldwideRadioScanner/1.0",
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Radio Browser API error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (err) {
        lastError = err;
        // Advance to next mirror and retry
        mirrorIdx++;
      }
    }

    throw lastError || new Error("All Radio Browser mirrors unavailable. Check your connection.");
  }

  /**
   * Retrieve all countries (sorted by station count desc).
   * @returns {Promise<Array<{name, stationcount}>>}
   */
  function getCountries() {
    return get("/countries", { order: "stationcount", reverse: "true", hidebroken: "true" });
  }

  /**
   * Fetch stations for a given country ISO 3166-1 code or full name.
   * @param {string} countryCode  – two-letter ISO code, e.g. "US"
   * @param {number} [limit=200]
   * @returns {Promise<Array>}
   */
  function getStationsByCountry(countryCode, limit = 200) {
    return get(`/stations/bycountrycodeexact/${encodeURIComponent(countryCode)}`, {
      limit,
      order: "votes",
      reverse: "true",
      hidebroken: "true",
    });
  }

  /**
   * Fetch stations matching a free-text name query.
   * @param {string} name
   * @param {number} [limit=100]
   * @returns {Promise<Array>}
   */
  function searchByName(name, limit = 100) {
    return get(`/stations/byname/${encodeURIComponent(name)}`, {
      limit,
      hidebroken: "true",
      order: "votes",
      reverse: "true",
    });
  }

  /**
   * Fetch stations by tag/genre.
   * @param {string} tag   – e.g. "police", "news", "pop"
   * @param {number} [limit=100]
   * @returns {Promise<Array>}
   */
  function getStationsByTag(tag, limit = 100) {
    return get(`/stations/bytag/${encodeURIComponent(tag)}`, {
      limit,
      hidebroken: "true",
      order: "votes",
      reverse: "true",
    });
  }

  /**
   * Fetch top stations worldwide.
   * @param {number} [limit=100]
   * @returns {Promise<Array>}
   */
  function getTopStations(limit = 100) {
    return get("/stations", {
      limit,
      order: "votes",
      reverse: "true",
      hidebroken: "true",
    });
  }

  /**
   * Register a "click" (play event) for a station so the community
   * stats stay accurate.
   * @param {string} stationuuid
   */
  function registerClick(stationuuid) {
    // Fire-and-forget; ignore errors silently.
    fetch(`${baseUrl()}/url/${stationuuid}`, {
      method: "GET",
      headers: {
        "User-Agent": "WorldwideRadioScanner/1.0",
        "Accept": "application/json",
      },
    }).catch(() => {});
  }

  return { getCountries, getStationsByCountry, searchByName, getStationsByTag, getTopStations, registerClick };
})();

// Make available as a module if bundled, otherwise the IIFE result is global.
if (typeof module !== "undefined" && module.exports) {
  module.exports = RadioBrowser;
}
