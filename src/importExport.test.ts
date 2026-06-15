import { describe, it, expect } from "vitest";
import { planDedupe } from "./importExport";
import type { Entry } from "./types";

function entry(p: Partial<Entry> & { id: string; searchKey: string }): Entry {
  return {
    translit: p.searchKey,
    heardForms: [],
    script: "",
    meaning: "m",
    root: "",
    note: "",
    tags: [],
    source: "seeded",
    verified: false,
    lookupCount: 0,
    contextHeard: "",
    dateAdded: 0,
    ...p,
  };
}

describe("planDedupe", () => {
  it("returns nothing when there are no duplicates", () => {
    const entries = [
      entry({ id: "a", searchKey: "k1" }),
      entry({ id: "b", searchKey: "k2" }),
    ];
    expect(planDedupe(entries)).toEqual([]);
  });

  it("collapses a duplicated corpus to one entry per searchKey", () => {
    // Two copies of every key — the seed-double scenario.
    const entries = [
      entry({ id: "a1", searchKey: "k1" }),
      entry({ id: "a2", searchKey: "k1" }),
      entry({ id: "b1", searchKey: "k2" }),
      entry({ id: "b2", searchKey: "k2" }),
    ];
    expect(planDedupe(entries).sort()).toHaveLength(2);
  });

  it("keeps the verified entry over an unverified duplicate", () => {
    const entries = [
      entry({ id: "keep", searchKey: "k", verified: true }),
      entry({ id: "drop", searchKey: "k", verified: false }),
    ];
    expect(planDedupe(entries)).toEqual(["drop"]);
  });

  it("breaks ties by higher lookupCount, then earliest dateAdded", () => {
    const entries = [
      entry({ id: "drop", searchKey: "k", lookupCount: 1, dateAdded: 5 }),
      entry({ id: "keep", searchKey: "k", lookupCount: 9, dateAdded: 50 }),
    ];
    expect(planDedupe(entries)).toEqual(["drop"]);

    const tie = [
      entry({ id: "keep", searchKey: "k", lookupCount: 3, dateAdded: 10 }),
      entry({ id: "drop", searchKey: "k", lookupCount: 3, dateAdded: 99 }),
    ];
    expect(planDedupe(tie)).toEqual(["drop"]);
  });
});
