/**
 * Bitcoin Crusher — Entropy Engine
 *
 * Uses the latest Bitcoin block hash as deterministic entropy to select
 * a radio channel category. The 64-character hex hash is converted to a
 * BigInt, then "crushed" (mod 16) into one of 16 curated channel categories
 * that map directly to Radio Browser tags.
 *
 * CORS-friendly public APIs, no key required.
 *   Primary:  https://blockchain.info/latestblock
 *   Fallback: https://mempool.space/api/blocks/tip (latest 10 blocks)
 *   Fallback: https://api.blockcypher.com/v1/btc/main
 */

const BitcoinCrusher = (() => {

  /**
   * 16 channel categories — each maps to a Radio Browser tag so stations
   * can be fetched immediately after the hash is crushed.
   *
   * Emojis match the problem-statement channel layout:
   *   🎷jazz · 🎨masterpiece · 🍄police scanner · 😎cool
   *   🛸alien · 👌top notch · ⭐trendy · 💃dance
   *   ♥️love · 🧱military comms · 🟨news · 🟦conversation ham
   *   🟥shortwave · 🟪FM · 🟩AM · ⬜digital live
   */
  const CHANNELS = [
    { id: "jazz",       emoji: "🎷", label: "Jazz",               tag: "jazz"           },
    { id: "classical",  emoji: "🎨", label: "Masterpiece",        tag: "classical"      },
    { id: "police",     emoji: "🍄", label: "Police Scanner",     tag: "police scanner" },
    { id: "chill",      emoji: "😎", label: "Cool / Chill",       tag: "chill"          },
    { id: "electronic", emoji: "🛸", label: "Alien / Electronic", tag: "electronic"     },
    { id: "top",        emoji: "👌", label: "Top Notch",          tag: "top 40"         },
    { id: "pop",        emoji: "⭐", label: "Trendy / Pop",        tag: "pop"            },
    { id: "dance",      emoji: "💃", label: "Dance",              tag: "dance"          },
    { id: "love",       emoji: "♥️", label: "Love / Romance",     tag: "love songs"     },
    { id: "military",   emoji: "🧱", label: "Military Comms",     tag: "military"       },
    { id: "news",       emoji: "🟨", label: "News",               tag: "news"           },
    { id: "talk",       emoji: "🟦", label: "Conversation / Ham", tag: "talk"           },
    { id: "shortwave",  emoji: "🟥", label: "Shortwave",          tag: "shortwave"      },
    { id: "fm",         emoji: "🟪", label: "FM",                 tag: "fm"             },
    { id: "am",         emoji: "🟩", label: "AM",                 tag: "am"             },
    { id: "digital",    emoji: "⬜", label: "Digital Live",       tag: "news"           },
  ];

  /**
   * Fetch the latest Bitcoin block hash and height.
   * Tries blockchain.info first; falls back to mempool.space, then BlockCypher.
   *
   * @returns {Promise<{hash: string, height: number}>}
   */
  async function fetchLatestBlock() {
    // Primary: blockchain.info (CORS-open, no key)
    try {
      const res = await fetch("https://blockchain.info/latestblock", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hash && typeof data.height === "number") {
          return { hash: data.hash, height: data.height };
        }
      }
    } catch (_) {
      /* fall through to next fallback */
    }

    // Fallback 1: mempool.space — tip hash + height as separate requests
    try {
      const [hashRes, heightRes] = await Promise.all([
        fetch("https://mempool.space/api/blocks/tip/hash"),
        fetch("https://mempool.space/api/blocks/tip/height"),
      ]);
      if (hashRes.ok && heightRes.ok) {
        const hash   = (await hashRes.text()).trim();
        const height = parseInt(await heightRes.text(), 10);
        if (/^[0-9a-f]{64}$/i.test(hash) && !isNaN(height)) {
          return { hash, height };
        }
      }
    } catch (_) {
      /* fall through to final fallback */
    }

    // Fallback 2: BlockCypher (CORS-open, no key for read-only)
    const res = await fetch("https://api.blockcypher.com/v1/btc/main", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Bitcoin API unavailable (${res.status}). Try again later.`);
    }
    const data = await res.json();
    return { hash: data.hash, height: data.height };
  }

  /**
   * Crush a 64-char hex hash into a channel index.
   * Uses native BigInt for full 256-bit modulo precision —
   * no floating-point rounding, no entropy loss.
   *
   * @param {string} hash  – 64-character hex string
   * @returns {number}     – integer in range [0, CHANNELS.length)
   */
  function hashToIndex(hash) {
    return Number(BigInt("0x" + hash) % BigInt(CHANNELS.length));
  }

  /**
   * Spin the dial: fetch the latest block, crush the hash,
   * and return the selected channel with all metadata.
   *
   * @returns {Promise<{hash: string, height: number, index: number, channel: Object}>}
   */
  async function spin() {
    const { hash, height } = await fetchLatestBlock();
    const index   = hashToIndex(hash);
    const channel = CHANNELS[index];
    return { hash, height, index, channel };
  }

  return { spin, CHANNELS };
})();

// CommonJS compat for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = BitcoinCrusher;
}
