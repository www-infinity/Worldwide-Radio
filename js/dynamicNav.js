/**
 * Dynamic Navigation
 *
 * Fetches all public repositories from the www-infinity GitHub organisation
 * using the public GitHub API (no key required, 60 req/hr unauthenticated).
 * Groups them into the same five categories as the static nav, then replaces
 * the hamburger menu content.
 *
 * Results are cached in localStorage for 1 hour so the API is called at most
 * once per tab-session. An auto-refresh fires every hour while the page is open.
 */
const DynamicNav = (() => {
  const ORG       = "www-infinity";
  const CACHE_KEY = "www_infinity_repos_v2";
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
  const CURRENT   = "Worldwide-Radio"; // mark current page

  // Migrate: remove stale v1 cache entry if present
  try { localStorage.removeItem("www_infinity_repos_v1"); } catch (_) {}

  // Keywords that map a repo name to a group label
  const GROUPS = [
    {
      label: "⚡ Signal & Energy",
      keys:  ["radio", "flux", "hydrogen", "hosting", "signal", "freq", "wave"],
    },
    {
      label: "🎨 Graphics & Design",
      keys:  ["graphics", "3d", "beyond", "visual", "design", "art"],
    },
    {
      label: "🎮 Entertainment",
      keys:  ["theater", "musiverse", "zelda", "mario", "wizard", "nes", "aces", "movie", "cartoon"],
    },
    {
      label: "🔬 Science & Tech",
      keys:  ["ion", "time", "future", "digital", "r2d2", "hydr", "element", "spawn", "c13", "74-", "56-"],
    },
    {
      label: "💰 Finance & Tokens",
      keys:  ["mint", "bitcoin", "token", "hash", "flaw", "crush"],
    },
  ];
  const FALLBACK_GROUP = "🛠 Infrastructure";

  // ── Helpers ────────────────────────────────────────────────────────────────

  function categorise(name) {
    const lower = name.toLowerCase();
    for (const g of GROUPS) {
      if (g.keys.some((k) => lower.includes(k))) return g.label;
    }
    return FALLBACK_GROUP;
  }

  function prettyName(name) {
    return name
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/Nes\b/g, "NES")
      .replace(/Npx\b/g, "NPX")
      .replace(/R2d2\b/gi, "R2D2")
      .slice(0, 36);
  }

  // ── Fetch repos from GitHub API with pagination ────────────────────────────

  async function fetchRepos() {
    // Return cached copy if still fresh
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.repos)) {
          return cached.repos;
        }
      }
    } catch (_) { /* corrupted cache – ignore */ }

    // Paginate (GitHub returns max 100 per page)
    const all = [];
    let page = 1;
    for (;;) {
      const res = await fetch(
        `https://api.github.com/users/${ORG}/repos?per_page=100&page=${page}&sort=updated`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const batch = await res.json();
      all.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), repos: all }));
    } catch (_) { /* quota exceeded – skip caching */ }

    return all;
  }

  // ── Build DOM from repo list ───────────────────────────────────────────────

  function buildMenu(repos, menuEl) {
    const sorted = [...repos].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    // Collect into groups preserving GROUPS order
    const buckets = {};
    const order   = [...GROUPS.map((g) => g.label), FALLBACK_GROUP];
    order.forEach((l) => (buckets[l] = []));
    sorted.forEach((r) => buckets[categorise(r.name)].push(r));

    menuEl.innerHTML = "";

    order.forEach((groupLabel) => {
      const items = buckets[groupLabel];
      if (!items.length) return;

      const groupLi = document.createElement("li");
      groupLi.className = "nav-group-label";
      groupLi.textContent = groupLabel;
      menuEl.appendChild(groupLi);

      items.forEach((repo) => {
        const li = document.createElement("li");
        const a  = document.createElement("a");
        a.href        = repo.html_url;
        a.target      = "_blank";
        a.rel         = "noopener";
        a.textContent = prettyName(repo.name);
        if (repo.name === CURRENT) a.setAttribute("aria-current", "page");
        li.appendChild(a);
        menuEl.appendChild(li);
      });
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function refresh(force = false) {
    const menuEl = document.getElementById("navMenu");
    if (!menuEl) return;
    try {
      if (force) {
        try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
      }
      const repos = await fetchRepos();
      buildMenu(repos, menuEl);
    } catch (e) {
      // Silently fall back to the static HTML already in the menu
      console.warn("DynamicNav: API fetch failed, keeping static fallback.", e.message);
    }
  }

  function init() {
    // Initial load (async, non-blocking)
    refresh();

    // Hourly auto-refresh while page is open
    setInterval(() => refresh(true), CACHE_TTL);
  }

  return { init, refresh };
})();
