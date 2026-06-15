import { getAllEntries, bulkPut, bulkDelete, makeEntry } from "./db";
import { makeSearchKey } from "./search";
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
 * ({meta, entries}) and a bare seed-style array/object. Rows with an id
 * overwrite by id. Id-less rows (e.g. the seed file) reuse the id of any
 * existing entry with the same searchKey so re-importing overwrites rather
 * than duplicating the whole corpus. Returns count imported.
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

  // Map existing searchKeys → id so id-less rows overwrite their match.
  const idByKey = new Map<string, string>();
  for (const e of await getAllEntries()) idByKey.set(e.searchKey, e.id);

  const entries: Entry[] = rows
    .filter((r) => r && typeof r.translit === "string" && typeof r.meaning === "string")
    .map((r) => {
      const key = makeSearchKey(r.translit as string);
      const id = r.id ?? idByKey.get(key);
      const entry = makeEntry({
        id,
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
      });
      // Collapse duplicate id-less rows within this same file too.
      idByKey.set(key, entry.id);
      return entry;
    });

  if (entries.length === 0) throw new Error("No valid entries found in file.");

  await bulkPut(entries);
  return entries.length;
}

/**
 * Decide which entry ids to delete to collapse duplicate searchKeys to one
 * each. Keeps the "best" of each group: verified first, then most looked up,
 * then earliest added. Pure (no DB) so it can be unit-tested.
 */
export function planDedupe(entries: Entry[]): string[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const g = groups.get(e.searchKey);
    if (g) g.push(e);
    else groups.set(e.searchKey, [e]);
  }

  const removeIds: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a.lookupCount !== b.lookupCount) return b.lookupCount - a.lookupCount;
      return a.dateAdded - b.dateAdded;
    });
    for (const e of sorted.slice(1)) removeIds.push(e.id);
  }
  return removeIds;
}

/** One-shot cleanup: remove duplicate-searchKey entries. Returns count removed. */
export async function dedupeGlossary(): Promise<number> {
  const removeIds = planDedupe(await getAllEntries());
  if (removeIds.length > 0) await bulkDelete(removeIds);
  return removeIds.length;
}
