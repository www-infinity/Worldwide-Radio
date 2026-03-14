/**
 * Bitcoin Research Writer
 *
 * Each time the Bitcoin Crusher spins, this module can optionally commit
 * the result to the Worldwide-Radio GitHub repository as a research log
 * entry at data/btc-research.json, using a user-supplied GitHub Personal
 * Access Token (GHP token) stored only in localStorage.
 *
 * The token is NEVER stored in the source code or environment files.
 * It is kept solely in the browser's localStorage at key:
 *   www_infinity_ghp_token_v1
 *
 * If no token is configured the write is skipped silently; the result is
 * always saved locally via UserProfile.logCrush().
 *
 * GitHub API reference:
 *   PUT /repos/{owner}/{repo}/contents/{path}
 */

const BitcoinResearchWriter = (() => {
  const LS_KEY    = "www_infinity_ghp_token_v1";
  const OWNER     = "www-infinity";
  const REPO      = "Worldwide-Radio";
  const FILE_PATH = "data/btc-research.json";
  const API_BASE  = "https://api.github.com";

  /** Read the stored GHP token (may be empty string). */
  function getToken() {
    try { return localStorage.getItem(LS_KEY) || ""; }
    catch (_) { return ""; }
  }

  /** Persist a new GHP token (empty string clears it). */
  function setToken(token) {
    try {
      token
        ? localStorage.setItem(LS_KEY, token.trim())
        : localStorage.removeItem(LS_KEY);
    } catch (_) {}
  }

  /**
   * Fetch the current file contents from GitHub (if it exists).
   * Returns { sha, entries } or null if the file doesn't exist yet.
   *
   * @param {string} token
   * @returns {Promise<{sha: string, entries: Array}|null>}
   */
  async function fetchCurrentFile(token) {
    const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data    = await res.json();
    const decoded = atob(data.content.replace(/\n/g, ""));
    const entries = JSON.parse(decoded);
    return { sha: data.sha, entries: Array.isArray(entries) ? entries : [] };
  }

  /**
   * Write (create or update) the research file on GitHub.
   *
   * @param {Object} spinResult  – { hash, height, index, channel }
   * @returns {Promise<boolean>}  – true on success, false if token not set
   */
  async function write(spinResult) {
    const token = getToken();
    if (!token) return false;

    const { hash, height, index, channel } = spinResult;

    // Build a new entry
    const entry = {
      ts:      new Date().toISOString(),
      block:   height,
      hash:    hash.slice(0, 16) + "…",
      fullHash: hash,
      index,
      channelId:    channel.id,
      channelLabel: channel.label,
      channelEmoji: channel.emoji,
      channelTag:   channel.tag,
    };

    try {
      const current = await fetchCurrentFile(token);
      const entries = current ? current.entries : [];
      // Prepend new entry; keep last 200
      entries.unshift(entry);
      const trimmed = entries.slice(0, 200);

      const newContent = btoa(
        String.fromCharCode(...new TextEncoder().encode(JSON.stringify(trimmed, null, 2)))
      );

      const body = {
        message: `₿ Spin #${height}: ${channel.emoji} ${channel.label} [${channel.id}]`,
        content: newContent,
        committer: {
          name:  "Worldwide Radio Scanner",
          email: "scanner@users.noreply.github.com",
        },
      };
      if (current) body.sha = current.sha;

      const res = await fetch(
        `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`GitHub write failed (${res.status}): ${err.slice(0, 200)}`);
      }

      return true;
    } catch (err) {
      console.warn("[BitcoinResearchWriter] Could not write to GitHub:", err.message);
      return false;
    }
  }

  return { write, getToken, setToken };
})();

// CommonJS compat for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = BitcoinResearchWriter;
}
