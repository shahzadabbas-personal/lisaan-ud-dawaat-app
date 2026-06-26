import { countEntries, bulkPut, makeEntry } from "./db";
import type { Entry } from "./types";

interface SeedRow {
  translit: string;
  heardForms?: string[];
  script?: string;
  meaning: string;
  root?: string;
  note?: string;
  tags?: string[];
  source?: Entry["source"];
  verified?: boolean;
}

interface SeedFile {
  entries: SeedRow[];
}

/** Load the bundled seed corpus into the store, but only if it's empty. */
export function loadSeedIfEmpty(): Promise<number> {
  // Share one in-flight load so concurrent callers (e.g. React StrictMode's
  // double effect invocation in dev) can't both pass the empty check and
  // seed the corpus twice.
  if (!seedPromise) seedPromise = doLoadSeedIfEmpty();
  return seedPromise;
}

let seedPromise: Promise<number> | null = null;

async function doLoadSeedIfEmpty(): Promise<number> {
  const existing = await countEntries();
  if (existing > 0) return 0;

  const res = await fetch(`${import.meta.env.BASE_URL}waaz-seed.json`);
  if (!res.ok) throw new Error(`Failed to load seed: ${res.status}`);
  const data = (await res.json()) as SeedFile;

  const entries = data.entries.map((row) =>
    makeEntry({
      translit: row.translit,
      heardForms: row.heardForms ?? [],
      script: row.script ?? "",
      meaning: row.meaning,
      root: row.root ?? "",
      note: row.note ?? "",
      tags: row.tags ?? [],
      source: row.source ?? "seeded",
      verified: row.verified ?? false,
    }),
  );

  await bulkPut(entries);
  return entries.length;
}
