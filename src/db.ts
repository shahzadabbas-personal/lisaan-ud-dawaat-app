import Dexie, { type Table } from "dexie";
import type { Entry } from "./types";
import { makeSearchKey } from "./search";

export class WaazDB extends Dexie {
  entries!: Table<Entry, string>;

  constructor() {
    super("waaz-companion");
    this.version(1).stores({
      entries: "id, translit, *heardForms, *tags, lookupCount, dateAdded, searchKey",
    });
  }
}

export const db = new WaazDB();

function uuid(): string {
  return crypto.randomUUID();
}

/** Build a complete Entry from partial fields, filling defaults + searchKey. */
export function makeEntry(p: Partial<Entry> & { translit: string; meaning: string }): Entry {
  return {
    id: p.id ?? uuid(),
    translit: p.translit.trim(),
    heardForms: p.heardForms ?? [],
    script: p.script ?? "",
    meaning: p.meaning.trim(),
    root: p.root ?? "",
    note: p.note ?? "",
    tags: p.tags ?? [],
    source: p.source ?? "manual",
    verified: p.verified ?? false,
    lookupCount: p.lookupCount ?? 0,
    contextHeard: p.contextHeard ?? "",
    dateAdded: p.dateAdded ?? Date.now(),
    searchKey: makeSearchKey(p.translit),
  };
}

export async function getAllEntries(): Promise<Entry[]> {
  return db.entries.toArray();
}

export async function putEntry(entry: Entry): Promise<void> {
  // keep searchKey in sync with translit on every write
  entry.searchKey = makeSearchKey(entry.translit);
  await db.entries.put(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function incrementLookup(id: string): Promise<void> {
  const e = await db.entries.get(id);
  if (e) {
    e.lookupCount += 1;
    await db.entries.put(e);
  }
}

export async function countEntries(): Promise<number> {
  return db.entries.count();
}

export async function bulkPut(entries: Entry[]): Promise<void> {
  await db.entries.bulkPut(entries);
}
