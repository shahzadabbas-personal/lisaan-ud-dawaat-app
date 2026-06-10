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
  ou: "u", // nour -> nur
  au: "aw", // tauhid -> tawhid
  ai: "ay", // husain -> husayn
  ei: "ay", // hussein -> husayn
  iy: "i", // wasiy -> wasi (after yy collapse)
  th: "s",
  dh: "z", // dhikr -> zikr
  ph: "f", // phir -> fir
  kh: "kh", // kept as a cluster
  gh: "gh", // kept as a cluster
  ch: "ch", // kept as a cluster (protects c -> k below)
  sh: "sh", // kept as a cluster (protects s passthrough)
};

const SINGLE: Record<string, string> = {
  q: "k",
  c: "k", // lone c is a hard-k guess
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
  // 4. phonetic fold — to fixpoint, since one pass can expose a new pair
  //    (waseey -> wasiy -> wasi). All folds are contractive or stable.
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = fold(s);
  }
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
const TIER_PREFIX = 1; // whole-key or word-boundary prefix
const TIER_SUBSTR = 2; // query inside the key (heard the middle of a word)
const TIER_MEANING = 3;
const TIER_FUZZY = 4;

interface Scored {
  entry: Entry;
  tier: number;
  distance: number;
}

/**
 * Rank entries against a query. Strategy (ranked):
 *  1. exact searchKey/heardForm equality
 *  2. prefix match — whole key, either direction, or any word of a phrase
 *  3. substring — query heard mid-word (>= 3 chars)
 *  4. meaning substring (search by remembered English)
 *  5. fuzzy: Levenshtein <= 1 for short queries, <= 2 otherwise
 */
export function searchEntries(
  query: string,
  index: SearchIndex,
  limit = 30,
): Entry[] {
  const q = normalize(query);
  if (!q) return [];

  // Short queries get a tighter fuzzy net — 2 edits on a 4-char guess is noise.
  const maxFuzzy = q.length <= 4 ? 1 : 2;

  const results: Scored[] = [];

  for (const item of index) {
    let best: Scored | null = null;

    const consider = (tier: number, distance: number) => {
      if (!best || tier < best.tier || (tier === best.tier && distance < best.distance)) {
        best = { entry: item.entry, tier, distance };
      }
    };

    for (const key of item.keys) {
      if (key === q) {
        consider(TIER_EXACT, 0);
        break; // can't beat exact
      }
      if (key.startsWith(q) || q.startsWith(key)) {
        consider(TIER_PREFIX, Math.abs(key.length - q.length));
        continue;
      }
      if (key.includes(" ")) {
        // phrase entry: match the query against each word
        for (const word of key.split(" ")) {
          if (word === q || word.startsWith(q)) {
            // +1 so a whole-key prefix outranks a word-of-phrase prefix
            consider(TIER_PREFIX, Math.abs(word.length - q.length) + 1);
          }
        }
      }
      if (q.length >= 3 && key.includes(q)) {
        consider(TIER_SUBSTR, key.length - q.length);
      }
    }

    if ((!best || (best as Scored).tier > TIER_MEANING) && q.length >= 3 && item.meaningNorm.includes(q)) {
      consider(TIER_MEANING, 0);
    }

    if (!best || (best as Scored).tier > TIER_FUZZY) {
      let bestDist = maxFuzzy + 1;
      for (const key of item.keys) {
        const d = boundedLevenshtein(q, key, maxFuzzy);
        if (d < bestDist) bestDist = d;
      }
      if (bestDist <= maxFuzzy) {
        consider(TIER_FUZZY, bestDist);
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
