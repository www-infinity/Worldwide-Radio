/**
 * AI Assistant — ∞ Radio Intelligence
 *
 * Provides a chat interface for the Worldwide Radio Scanner.
 *
 * Works in two modes:
 *   1. Rule-based (always on) — instant answers for common questions about the
 *      scanner, Bitcoin Crusher, genres, and www-infinity repos.
 *   2. AI API (optional) — if the user supplies an OpenAI-compatible API key
 *      via the Settings UI it is stored ONLY in localStorage (never in code or
 *      the repository). Any OpenAI-compatible endpoint (OpenAI, OpenRouter,
 *      Groq, etc.) works.
 *
 * Conversation history is persisted via UserProfile.addChatMessage().
 */
const AIAssistant = (() => {
  const LS_KEY     = "www_infinity_ai_key_v1";
  const LS_URL_KEY = "www_infinity_ai_url_v1";
  const DEFAULT_URL   = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_MODEL = "gpt-4o-mini";

  const SYSTEM_PROMPT = `You are the AI assistant for Worldwide Radio Scanner (www-infinity.github.io/Worldwide-Radio).
You help users discover and stream live radio stations, understand the Bitcoin Crusher entropy engine, and explore the www-infinity GitHub organisation.

Key facts:
- The app uses the Radio Browser public API (40,000+ free stations, no key required).
- The Bitcoin Crusher fetches the latest Bitcoin block hash, converts it to a BigInt, and uses modulo-16 to deterministically pick one of 16 radio genres.
- Genres include: Jazz, Classical/Masterpiece, Police Scanner, Military, Chill, Pop, Electronic/Alien, Talk, Shortwave, News/Digital Live, Rock, Hip-Hop, Reggae, Country, Folk, Ambient.
- The hamburger menu lists all www-infinity repos, refreshed hourly from the GitHub API.
- User profiles and history are stored in localStorage (no server, no passwords).
- The AI assistant can use an optional user-provided API key (stored in localStorage only).

Keep answers concise and helpful. Use plain language. Emojis are welcome but keep them sparse.`;

  // ── Rule-based intents (no API call needed) ───────────────────────────────

  const INTENTS = [
    {
      patterns: [/\b(scan|scanning|auto.?scan|start scan)\b/i],
      reply: "Hit ⚡ **Scan** to auto-cycle through stations. Use the **Dwell** slider (3–30 s) to control how long it stays on each station before jumping to the next.",
    },
    {
      patterns: [/bitcoin|crusher|block hash|btc|entropy|mod.?16/i],
      reply: "The **Bitcoin Crusher** grabs the latest Bitcoin block hash, wraps it into a BigInt, and does `hash mod 16` to pick one of 16 radio genres — deterministically. Every new block (~10 min) can give a different result. Hit **Spin the Dial** to try it.",
    },
    {
      patterns: [/police|scanner|emergency|dispatch/i],
      reply: "Search for **police scanner** in the search box, or choose *Police Scanner* from the Genre dropdown. The Bitcoin Crusher can also land on 🚔 Police Scanner automatically.",
    },
    {
      patterns: [/shortwave|sw radio|\bam\b.*radio/i],
      reply: "Pick **Shortwave** or **AM** from the Genre/Type dropdown to browse shortwave and medium-wave stations worldwide.",
    },
    {
      patterns: [/country|filter.*country|stations.*from|which country/i],
      reply: "Use the **Country** dropdown to load the top-voted stations from any nation. It's populated dynamically from the Radio Browser API.",
    },
    {
      patterns: [/history|what.*(played|listened)|last.*(station|played)/i],
      reply: "Your **play history** (last 50 stations) and **crusher history** (last 20 spins) are saved in your browser profile. Click the avatar icon in the nav to view them.",
    },
    {
      patterns: [/login|sign.?in|account|profile|avatar/i],
      reply: "Click the **avatar button** (top-right of the nav bar) to open your profile. Set a display name — your history and preferences are saved locally. No server, no password.",
    },
    {
      patterns: [/ai.*(key|api)|api.*(key|secret)|openai|groq|openrouter/i],
      reply: "Open your **profile** → **Settings** → paste your OpenAI-compatible API key. It's stored only in your browser's localStorage and never leaves your device.",
    },
    {
      patterns: [/hamburger|menu|repos?|github|all.*(repo|project)/i],
      reply: "The ☰ **hamburger menu** lists all www-infinity GitHub repositories, auto-grouped by category. It fetches fresh data from the GitHub API every hour and falls back to a static list offline.",
    },
    {
      patterns: [/auto.?sync|auto.?refresh|new block|block.*(update|notify)/i],
      reply: "The Bitcoin Crusher polls for a new block every 10 minutes. When the block height changes, a toast notification appears and you can re-spin to get a new genre pick.",
    },
    {
      patterns: [/\b(help|commands?|what can you do|features)\b/i],
      reply: `I can help with:\n• **Finding & playing** radio stations\n• **Bitcoin Crusher** — entropy-based genre selection\n• **Scanner controls** — Scan, Prev, Next, Stop, Dwell\n• **Browsing** by country or genre\n• **Profile** — play history, crusher history, settings\n• **Nav** — dynamic repo list\n\nJust ask! 📡`,
    },
    {
      patterns: [/\b(hi|hello|hey|good morning|good evening|yo|sup)\b/i],
      reply: "Hey! Ready to scan the airwaves? Ask me about stations, the Bitcoin Crusher, controls, or anything else about the scanner. 📡",
    },
    {
      patterns: [/thanks?|thank you|cheers|appreciate/i],
      reply: "You're welcome! Happy scanning. 🎷",
    },
  ];

  function matchIntent(text) {
    for (const intent of INTENTS) {
      if (intent.patterns.some((p) => p.test(text))) return intent.reply;
    }
    return null;
  }

  // ── API key management (localStorage only) ────────────────────────────────

  function getApiKey() { return localStorage.getItem(LS_KEY) || ""; }
  function getApiUrl() { return localStorage.getItem(LS_URL_KEY) || DEFAULT_URL; }

  function setApiKey(key) {
    key ? localStorage.setItem(LS_KEY, key) : localStorage.removeItem(LS_KEY);
  }

  function setApiUrl(url) {
    localStorage.setItem(LS_URL_KEY, url || DEFAULT_URL);
  }

  // ── Core chat function ────────────────────────────────────────────────────

  /**
   * Send a message and get a reply.
   * @param {string} userText
   * @param {Array}  history  – recent [{role, content}] pairs for context
   * @returns {Promise<string>}
   */
  async function chat(userText, history = []) {
    // 1. Rule-based matching (instant, no network)
    const local = matchIntent(userText);
    if (local) return local;

    // 2. Fall through to AI API if key is set
    const apiKey = getApiKey();
    if (!apiKey) {
      return "I don't have a pre-built answer for that. To unlock full AI responses, add an OpenAI-compatible API key in ⚙ **Settings** (your profile → Settings tab). Or try asking about scanning, the Bitcoin Crusher, or genres.";
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      // Include last 6 exchanges (12 messages) for context
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userText },
    ];

    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: DEFAULT_MODEL, messages, max_tokens: 350 }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`AI API ${res.status}: ${err.slice(0, 120)}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  // ── UI controller ─────────────────────────────────────────────────────────

  let chatOpen = false;

  function renderMessage(role, text, wrap) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-${role}`;
    // Convert **bold** markdown to <strong> and newlines to <br>
    div.innerHTML = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function initUI() {
    const toggleBtn  = document.getElementById("aiChatToggle");
    const panel      = document.getElementById("aiChatPanel");
    const closeBtn   = document.getElementById("aiChatClose");
    const msgWrap    = document.getElementById("aiChatMessages");
    const input      = document.getElementById("aiChatInput");
    const sendBtn    = document.getElementById("aiChatSend");

    if (!toggleBtn || !panel) return;

    // Restore history
    const profile = UserProfile.get();
    profile.chatHistory.slice(-20).forEach((m) => renderMessage(m.role, m.content, msgWrap));
    if (!profile.chatHistory.length) {
      renderMessage("assistant", "Hey! I'm your radio AI. Ask me anything about the scanner, Bitcoin Crusher, or genres. 📡", msgWrap);
    }

    toggleBtn.addEventListener("click", () => {
      chatOpen = !chatOpen;
      panel.hidden = !chatOpen;
      if (chatOpen) {
        input.focus();
        msgWrap.scrollTop = msgWrap.scrollHeight;
      }
    });

    closeBtn.addEventListener("click", () => {
      chatOpen = false;
      panel.hidden = true;
    });

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      input.disabled = true;
      sendBtn.disabled = true;

      renderMessage("user", text, msgWrap);
      UserProfile.addChatMessage("user", text);

      // Typing indicator
      const typing = document.createElement("div");
      typing.className = "chat-msg chat-assistant chat-typing";
      typing.textContent = "…";
      msgWrap.appendChild(typing);
      msgWrap.scrollTop = msgWrap.scrollHeight;

      try {
        const history = UserProfile.get().chatHistory;
        const reply = await chat(text, history);
        msgWrap.removeChild(typing);
        renderMessage("assistant", reply, msgWrap);
        UserProfile.addChatMessage("assistant", reply);
      } catch (e) {
        msgWrap.removeChild(typing);
        renderMessage("assistant", `Sorry, something went wrong: ${e.message}`, msgWrap);
      } finally {
        input.disabled  = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  return { chat, getApiKey, setApiKey, getApiUrl, setApiUrl, initUI, DEFAULT_URL };
})();
