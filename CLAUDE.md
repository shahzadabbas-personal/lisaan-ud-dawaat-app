# CLAUDE.md — Waaz Companion

Personal-use, single-user PWA for understanding unfamiliar Lisaan-ud-Dawat words
heard during waaz (sermons). Type a rough phonetic guess → get a meaning fast,
offline. Local misses fall back to the Anthropic API; whatever resolves is saved
to the local glossary so it joins the fast path next time.

Phases 1 + 2 (search, glossary, LLM fallback, thematic Browse/insights —
`src/components/BrowseView.tsx`). Out of scope (do **not** build without being
asked): audio capture + speech-to-text (Phase 3), French defs, spaced
repetition, anything multi-user.

## Commands

```bash
npm run dev        # dev server, hot reload (port 5173+)
npm test           # vitest — search-module tests (the critical ones)
npm run build      # tsc -b && vite build → dist/  (static PWA)
npm run preview    # serve the production build
```

Always run `npm test` and `npm run build` before declaring search or data
changes done — the build is the type-check (`tsc -b`) plus bundling.

## Architecture

Local-first, client-only. No backend. The **only** network call is the LLM
fallback to `api.anthropic.com`.

| Module | Role |
|---|---|
| `src/search.ts` | **The core.** Phonetic normalization + ranked fuzzy match. First-class, well-tested module — treat changes here as high-risk. |
| `src/search.test.ts` | 17 tests incl. the headline `waseey → waṣiyy`. Keep green. |
| `src/db.ts` | Dexie/IndexedDB store, `Entry` CRUD, `makeEntry`, lookup counts. |
| `src/types.ts` | `Entry` and `LlmCandidate` shapes. |
| `src/seed.ts` | Loads `public/waaz-seed.json` (167 entries) on first run only. |
| `src/settings.ts` | API key + model in localStorage. `KNOWN_MODELS`, `DEFAULT_MODEL`. |
| `src/llm.ts` | Anthropic Messages API call + defensive JSON parse of candidates. |
| `src/importExport.ts` | JSON backup/restore (accepts both export and seed shapes). |
| `src/App.tsx` | State container + tab nav (Search / Glossary / Settings). |
| `src/components/` | CaptureBar, ResultsList, EntryCard, AskFallback, GlossaryList, SettingsPanel, ImportExport. |

### Search normalization (read before touching `search.ts`)

Both stored entries and the live query reduce to one `searchKey` via
`normalize()`, then match. Order matters: lowercase → strip diacritics (NFD +
Arabic marks) → collapse doubled consonants → phonetic fold (q→k, th/ṣ/s→s,
ẓ/ż/z→z, w↔v→w, vowel-length folding) → trim. Match ranking: exact → prefix →
meaning-substring → fuzzy (Levenshtein ≤2). `buildSearchIndex()` precomputes keys
once per data change; per-keystroke search must stay <100ms.

### Data model

One entity: `Entry` (see `src/types.ts`). `searchKey` is precomputed from
`translit` and **must stay in sync** — `putEntry`/`makeEntry` recompute it on
every write. Seed entries are all `verified: false` on purpose; flip to true as
meanings are confirmed in real use. Be cautious with Fatimi/Ismaili-specific
senses.

### LLM fallback

`src/llm.ts` calls the Messages API directly from the browser (bring-your-own
key). Required: header `anthropic-dangerous-direct-browser-access: true` (else
CORS fails); key sent only in `x-api-key`, read from Settings, **never hardcoded
or committed**. System prompt asks for ranked JSON candidates with a confidence
field; parse defensively (strip code fences). Default model is Haiku
(`claude-haiku-4-5`) — cheapest, right for in-the-moment lookup; user can pick
Sonnet/Opus or a custom ID in Settings.

## Conventions

- React + Vite + TypeScript (strict). Plain CSS in `src/styles.css` — no CSS
  framework. Mobile-first, dark theme.
- `crypto.randomUUID()` for IDs — no `uuid` dependency.
- Exact-pinned deps (no `^`), `package-lock.json` committed.
- PWA via `vite-plugin-pwa` (`registerType: autoUpdate`); seed + icons precached.

## Gotchas

- `tsc -b` (composite build) emits `vite.config.js` / `vite.config.d.ts` next to
  source. Both are gitignored — they're generated, not source.
- `tsconfig.node.json` has `composite: true` and therefore **cannot** set
  `noEmit` (would error).
- Icons are generated programmatically by `scripts/gen-icons.mjs` (zlib only, no
  image lib). Re-run it if you change the icon design.

## Deployment

Static PWA, HTTPS mandatory (browsers refuse PWA install / service worker over
plain http). Build → host `dist/` on Cloudflare Pages / Vercel / Netlify (build
`npm run build`, output `dist`). Repo: `shahzadabbas-personal/lisaan-ud-dawaat-app`.
API key entered on-device in Settings; set a spend limit in the Anthropic console
(can't be set from the app).

The live deploy is Cloudflare Pages, building from `main`. The CF deploy step
runs `npx wrangler versions upload` (Worker-with-static-assets flow), and current
wrangler needs **Node ≥22** — so `.nvmrc` must stay at 22+ or the deploy step
fails *after* a green build. Don't downgrade it.
