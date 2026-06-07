# Waaz Companion — Phase 1

A local-first PWA for understanding unfamiliar Lisaan-ud-Dawat words heard during
waaz. Type a rough phonetic guess → get a meaning fast, offline. Local misses fall
back to the Anthropic API, and whatever resolves is saved into the local glossary.

## Run

```bash
npm install
npm run dev        # local dev server
npm test           # search-module tests
npm run build      # → dist/  (static PWA)
npm run preview    # serve the production build
```

## How it works

- **Search** (`src/search.ts`) — the core. Normalizes both the stored entry and
  the live query to one phonetic key (strip diacritics → collapse doubles →
  phonetic fold), then matches exact → prefix → meaning → fuzzy (Levenshtein ≤2).
  `"waseey"` finds `waṣiyy`. Fully tested in `src/search.test.ts`.
- **Storage** (`src/db.ts`) — IndexedDB via Dexie. Holds thousands of entries,
  works offline.
- **Seed** (`src/seed.ts`) — loads `public/waaz-seed.json` (167 entries, all
  `verified: false`) on first run only.
- **LLM fallback** (`src/llm.ts`) — calls Anthropic Messages API directly from
  the browser (bring-your-own-key, CORS header set), returns 1–3 structured
  candidates. Key lives in Settings (localStorage), never committed.
- **Backup** — JSON export/import (Settings tab). Export regularly; iOS can evict
  PWA storage.

## Deploy

1. `npm run build` → `dist/`
2. Host `dist/` on any HTTPS static host (Vercel / Netlify / Cloudflare Pages).
   HTTPS is mandatory for PWA install + service worker.
3. Install: iPhone → open in **Safari** → Share → Add to Home Screen.
   Android → Chrome → Install app.
4. Enter the API key in Settings on-device. Set a spending limit on the key in
   the Anthropic console.

## Scope

Phase 1 only: local glossary, fuzzy search, manual CRUD + verify, LLM fallback,
JSON import/export, seed-on-first-run. Phases 2–3 (thematic browse, insights,
audio capture) are deliberately out.
