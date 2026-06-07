import type { Entry } from "./types";

/**
 * Search normalization — the heart of the app.
 *
 * Both stored entries and the live query are reduced to the same canonical
 * "searchKey" via normalize(), so a rough phonetic guess ("waseey") collides
 * with the real word ("waṣiyy"). Order of steps matters; see §5 of the brief.
 */

// Phonetic folding — multi-char sequences checked before single chars.
const PAIRS: Record<string, string> = {
  aa: "a",
  ee: "i",
  oo: "u",
  th: "s",
  kh: "kh", // kept as a cluster
  gh: "gh", // kept as a cluster
};

const SINGLE: Record<string, string> = {
  q: "k",
  s: "s",
  z: "z",
  w: "w",
  v: "w", // w <-> v collapse to w
  a: "a",
  i: "i",
  u: "u",
  e: "i", // lone e folds toward i (phonetic guesses)
  o: "u", // lone o folds toward u
};

function fold(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const pair = PAIRS[two];
    if (pair !== undefined) {
      out += pair;
      i += 2;
      continue;
    }
    const ch = s[i];
    out += SINGLE[ch] ?? ch;
    i += 1;
  }
  return out;
}

// Collapse doubled consonants (ww -> w, ss -> s, yy -> y, ...). Vowels left
// to the fold step (aa -> a etc.) so "aa" and "a" stay distinguishable here.
function collapseDoubledConsonants(s: string): string {
  return s.replace(/([^aeiou\s])\1+/g, "$1");
}

export function normalize(input: string): string {
  if (!input) return "";
  // 1. lowercase
  let s = input.toLowerCase();
  // 2. strip Latin diacritics (NFD splits ṣ -> s + combining dot) and Arabic marks
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[ً-ٰٟـ]/g, ""); // tanwin..sukun, superscript alef, tatweel
  // strip glottal stops / ayn / hamza marks and apostrophes
  s = s.replace(/['’ʿʾ`ʼ]/g, "");
  // keep only latin letters, Arabic-script letters, and spaces
  s = s.replace(/[^a-z؀-ۿ\s]/g, " ");
  // 3. collapse doubled consonants
  s = collapseDoubledConsonants(s);
  // 4. phonetic fold
  s = fold(s);
  // defensive: collapse any consecutive duplicates the fold produced
  s = s.replace(/(.)\1+/g, "$1");
  // 5. trim + collapse whitespace
  s = s.trim().replace(/\s+/g, " ");
  return s;
}

/** Canonical key stored on an entry (derived from its translit). */
export function makeSearchKey(translit: string): string {
  return normalize(translit);
}

/**
 * Levenshtein distance with an early-exit ceiling. Returns `max + 1` if the
 * true distance exceeds `max`, so callers can cheaply reject far matches.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ---- Indexed search ----

interface IndexedEntry {
  entry: Entry;
  keys: string[]; // normalized translit + heardForms
  meaningNorm: string; // normalized meaning, for English half-recall
}

export type SearchIndex = IndexedEntry[];

/** Build once when the entry set changes; reused across keystrokes. */
export function buildSearchIndex(entries: Entry[]): SearchIndex {
  return entries.map((entry) => {
    const keys = new Set<string>();
    keys.add(entry.searchKey || normalize(entry.translit));
    for (const hf of entry.heardForms) {
      const k = normalize(hf);
      if (k) keys.add(k);
    }
    return {
      entry,
      keys: [...keys].filter(Boolean),
      meaningNorm: normalize(entry.meaning),
    };
  });
}

// Lower tier = stronger match.
const TIER_EXACT = 0;
const TIER_PREFIX = 1;
const TIER_MEANING = 2;
const TIER_FUZZY = 3;

interface Scored {
  entry: Entry;
  tier: number;
  distance: number;
}

/**
 * Rank entries against a query. Strategy (ranked):
 *  1. exact searchKey/heardForm equality
 *  2. prefix match
 *  3. meaning substring (search by remembered English)
 *  4. fuzzy: Levenshtein <= 2, ranked by distance then lookupCount
 */
export function searchEntries(
  query: string,
  index: SearchIndex,
  limit = 30,
): Entry[] {
  const q = normalize(query);
  if (!q) return [];

  const results: Scored[] = [];

  for (const item of index) {
    let best: Scored | null = null;

    for (const key of item.keys) {
      if (key === q) {
        best = { entry: item.entry, tier: TIER_EXACT, distance: 0 };
        break; // can't beat exact
      }
      if (key.startsWith(q) || q.startsWith(key)) {
        if (!best || best.tier > TIER_PREFIX) {
          // shorter length gap ranks higher within prefix tier
          best = {
            entry: item.entry,
            tier: TIER_PREFIX,
            distance: Math.abs(key.length - q.length),
          };
        }
        continue;
      }
    }

    if (!best || best.tier > TIER_MEANING) {
      if (q.length >= 3 && item.meaningNorm.includes(q)) {
        if (!best || best.tier > TIER_MEANING) {
          best = { entry: item.entry, tier: TIER_MEANING, distance: 0 };
        }
      }
    }

    if (!best || best.tier > TIER_FUZZY) {
      let bestDist = 3;
      for (const key of item.keys) {
        const d = boundedLevenshtein(q, key, 2);
        if (d < bestDist) bestDist = d;
      }
      if (bestDist <= 2) {
        if (!best || best.tier > TIER_FUZZY) {
          best = { entry: item.entry, tier: TIER_FUZZY, distance: bestDist };
        }
      }
    }

    if (best) results.push(best);
  }

  results.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.entry.lookupCount - a.entry.lookupCount;
  });

  return results.slice(0, limit).map((r) => r.entry);
}
