import { getAllEntries, bulkPut, makeEntry } from "./db";
import type { Entry } from "./types";

/** Export the whole glossary as a downloadable JSON file. */
export async function exportGlossary(): Promise<void> {
  const entries = await getAllEntries();
  const payload = {
    meta: {
      app: "waaz-companion",
      exportedAt: new Date().toISOString(),
      count: entries.length,
    },
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `waaz-glossary-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ImportRow {
  id?: string;
  translit?: string;
  heardForms?: string[];
  script?: string;
  meaning?: string;
  root?: string;
  note?: string;
  tags?: string[];
  source?: Entry["source"];
  verified?: boolean;
  lookupCount?: number;
  contextHeard?: string;
  dateAdded?: number;
}

/**
 * Import entries from a parsed JSON file. Accepts both a full export
 * ({meta, entries}) and a bare seed-style array/object. Rows with an existing
 * id overwrite by id; rows without one get a fresh id. Returns count imported.
 */
export async function importGlossary(text: string): Promise<number> {
  const data = JSON.parse(text) as unknown;

  let rows: ImportRow[];
  if (Array.isArray(data)) {
    rows = data as ImportRow[];
  } else if (data && typeof data === "object" && Array.isArray((data as { entries?: unknown }).entries)) {
    rows = (data as { entries: ImportRow[] }).entries;
  } else {
    throw new Error("Unrecognized file: expected an array or an { entries } object.");
  }

  const entries: Entry[] = rows
    .filter((r) => r && typeof r.translit === "string" && typeof r.meaning === "string")
    .map((r) =>
      makeEntry({
        id: r.id,
        translit: r.translit as string,
        heardForms: r.heardForms ?? [],
        script: r.script ?? "",
        meaning: r.meaning as string,
        root: r.root ?? "",
        note: r.note ?? "",
        tags: r.tags ?? [],
        source: r.source ?? "manual",
        verified: r.verified ?? false,
        lookupCount: r.lookupCount ?? 0,
        contextHeard: r.contextHeard ?? "",
        dateAdded: r.dateAdded ?? Date.now(),
      }),
    );

  if (entries.length === 0) throw new Error("No valid entries found in file.");

  await bulkPut(entries);
  return entries.length;
}
