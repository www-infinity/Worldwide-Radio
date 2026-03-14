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
 *   Fallback: https://api.blockcypher.com/v1/btc/main
 */

const BitcoinCrusher = (() => {

  /**
   * 16 channel categories — each maps to a Radio Browser tag so stations
   * can be fetched immediately after the hash is crushed.
   *
   * Ordering matches the problem statement categories:
   *   Jazz/Masterpiece · Police/Military · Cool/Trendy
   *   Alien · Conversation/Shortwave · Digital Live
   *   + 10 additional genres for full 16-slot coverage
   */
  const CHANNELS = [
    { id: "jazz",       emoji: "🎷", label: "Jazz",               tag: "jazz"           },
    { id: "classical",  emoji: "🎨", label: "Masterpiece",        tag: "classical"      },
    { id: "police",     emoji: "🚔", label: "Police Scanner",     tag: "police scanner" },
    { id: "military",   emoji: "🪖", label: "Military",           tag: "military"       },
    { id: "chill",      emoji: "😎", label: "Cool / Chill",       tag: "chill"          },
    { id: "pop",        emoji: "⭐", label: "Trendy / Pop",        tag: "pop"            },
    { id: "electronic", emoji: "🛸", label: "Alien / Electronic", tag: "electronic"     },
    { id: "talk",       emoji: "🟦", label: "Conversation",       tag: "talk"           },
    { id: "shortwave",  emoji: "📻", label: "Shortwave",          tag: "shortwave"      },
    { id: "news",       emoji: "⬜", label: "Digital Live",       tag: "news"           },
    { id: "rock",       emoji: "🎸", label: "Rock",               tag: "rock"           },
    { id: "hiphop",     emoji: "🎤", label: "Hip-Hop",            tag: "hip-hop"        },
    { id: "reggae",     emoji: "🌴", label: "Reggae",             tag: "reggae"         },
    { id: "country",    emoji: "🤠", label: "Country",            tag: "country"        },
    { id: "folk",       emoji: "🌍", label: "Folk / World",       tag: "folk"           },
    { id: "ambient",    emoji: "🌌", label: "Ambient / Space",    tag: "ambient"        },
  ];

  /**
   * Fetch the latest Bitcoin block hash and height.
   * Tries blockchain.info first; falls back to BlockCypher.
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
      /* fall through to fallback */
    }

    // Fallback: BlockCypher (CORS-open, no key for read-only)
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
