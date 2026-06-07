import { describe, it, expect } from "vitest";
import {
  normalize,
  boundedLevenshtein,
  buildSearchIndex,
  searchEntries,
  makeSearchKey,
} from "./search";
import type { Entry } from "./types";

function entry(partial: Partial<Entry>): Entry {
  const translit = partial.translit ?? "x";
  return {
    id: partial.id ?? translit,
    translit,
    heardForms: partial.heardForms ?? [],
    script: partial.script ?? "",
    meaning: partial.meaning ?? "",
    root: partial.root ?? "",
    note: partial.note ?? "",
    tags: partial.tags ?? [],
    source: partial.source ?? "seeded",
    verified: partial.verified ?? false,
    lookupCount: partial.lookupCount ?? 0,
    contextHeard: partial.contextHeard ?? "",
    dateAdded: partial.dateAdded ?? 0,
    searchKey: makeSearchKey(translit),
  };
}

describe("normalize", () => {
  it("lowercases and trims", () => {
    expect(normalize("  WaSi  ")).toBe("wasi");
  });

  it("strips Latin diacritics", () => {
    expect(normalize("waṣiyy")).toBe(normalize("wasiy"));
    expect(normalize("ma'rifat")).toBe(normalize("marifat"));
    expect(normalize("ā ī ū")).toBe("a i u");
  });

  it("collapses doubled consonants", () => {
    expect(normalize("waṣiyy")).toBe("wasiy");
    expect(normalize("nubuwwat")).toBe(normalize("nubuwat"));
  });

  it("folds phonetic equivalents", () => {
    expect(normalize("qafila")).toBe(normalize("kafila"));
    expect(normalize("wafa")).toBe(normalize("vafa"));
    expect(normalize("zulm")).toBe(normalize("ẓulm"));
    expect(normalize("thawab")).toBe(normalize("sawab"));
  });

  it("folds vowel length guesses", () => {
    expect(normalize("aashura")).toBe(normalize("ashura"));
    expect(normalize("shaheed")).toBe(normalize("shahid"));
    expect(normalize("rasool")).toBe(normalize("rasul"));
  });

  it("the headline case: waseey finds waṣiyy", () => {
    expect(normalize("waseey")).toBe(normalize("waṣiyy"));
  });

  it("strips apostrophes and leading glottal marks", () => {
    expect(normalize("'azaa")).toBe(normalize("azaa"));
    expect(normalize("masaa'ib")).toBe(normalize("masaaib"));
  });
});

describe("boundedLevenshtein", () => {
  it("returns 0 for identical", () => {
    expect(boundedLevenshtein("abc", "abc", 2)).toBe(0);
  });
  it("counts edits", () => {
    expect(boundedLevenshtein("kitten", "sitting", 5)).toBe(3);
  });
  it("ceilings out past max", () => {
    expect(boundedLevenshtein("abc", "xyzw", 2)).toBe(3);
  });
});

describe("searchEntries", () => {
  const entries = [
    entry({ translit: "waṣiyy", heardForms: ["wasi", "vasi"], meaning: "legatee, appointed successor" }),
    entry({ translit: "shahaadat", heardForms: ["shahadat"], meaning: "martyrdom" }),
    entry({ translit: "tawheed", meaning: "oneness of God" }),
    entry({ translit: "imam", lookupCount: 50, meaning: "leader" }),
    entry({ translit: "imamat", lookupCount: 2, meaning: "office of the imam" }),
  ];
  const index = buildSearchIndex(entries);

  it("finds exact via phonetic key", () => {
    const r = searchEntries("waseey", index);
    expect(r[0]?.translit).toBe("waṣiyy");
  });

  it("finds via heardForm", () => {
    const r = searchEntries("vasi", index);
    expect(r[0]?.translit).toBe("waṣiyy");
  });

  it("prefix match works", () => {
    const r = searchEntries("shaha", index);
    expect(r.map((e) => e.translit)).toContain("shahaadat");
  });

  it("fuzzy tolerates typos within distance 2", () => {
    const r = searchEntries("tauhid", index); // -> tawhid vs tawheed
    expect(r.map((e) => e.translit)).toContain("tawheed");
  });

  it("searches by remembered English meaning", () => {
    const r = searchEntries("martyr", index);
    expect(r.map((e) => e.translit)).toContain("shahaadat");
  });

  it("ranks exact above lookupCount", () => {
    const r = searchEntries("imam", index);
    expect(r[0]?.translit).toBe("imam"); // exact beats imamat
  });

  it("returns nothing for empty query", () => {
    expect(searchEntries("", index)).toEqual([]);
  });
});
