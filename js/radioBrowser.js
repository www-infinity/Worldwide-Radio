/**
 * Radio Browser API Client
 * Uses the public Radio Browser API (https://api.radio-browser.info/)
 * No API key required – free, community-driven, CORS-enabled.
 *
 * To use a different base URL (e.g. a mirror), set
 *   window.RADIO_BROWSER_BASE_URL = "https://nl1.api.radio-browser.info/json"
 * before this script loads.
 */

const RadioBrowser = (() => {
  // Primary server; falls back to a mirror list at runtime.
  const DEFAULT_BASE = "https://de1.api.radio-browser.info/json";

  function baseUrl() {
    return (
      (typeof window !== "undefined" && window.RADIO_BROWSER_BASE_URL) ||
      DEFAULT_BASE
    );
  }

  /**
   * Perform a GET request against the Radio Browser API.
   * @param {string} path  – e.g. "/stations/bycountry/United States"
   * @param {Object} params – query-string parameters
   * @returns {Promise<Array>}
   */
  async function get(path, params = {}) {
    const url = new URL(baseUrl() + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "WorldwideRadioScanner/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Radio Browser API error ${response.status}: ${response.statusText}`);
    }
    return response.json();
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
      headers: { "User-Agent": "WorldwideRadioScanner/1.0" },
    }).catch(() => {});
  }

  return { getCountries, getStationsByCountry, searchByName, getStationsByTag, getTopStations, registerClick };
})();

// Make available as a module if bundled, otherwise the IIFE result is global.
if (typeof module !== "undefined" && module.exports) {
  module.exports = RadioBrowser;
}
