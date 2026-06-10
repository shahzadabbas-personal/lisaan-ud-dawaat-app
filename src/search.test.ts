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
    expect(normalize("waṣiyy")).toBe("wasi"); // yy -> y, then iy -> i
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

  it("folds dh/ph/c spelling guesses", () => {
    expect(normalize("dhikr")).toBe(normalize("zikr"));
    expect(normalize("phir")).toBe(normalize("fir"));
    expect(normalize("calaam")).toBe(normalize("kalaam"));
    // ch/sh clusters survive the c->k and th->s folds
    expect(normalize("chand")).toBe("chand");
    expect(normalize("shahid")).toBe("shahid");
  });

  it("folds diphthong variants together", () => {
    expect(normalize("husain")).toBe(normalize("husayn"));
    expect(normalize("hussein")).toBe(normalize("husayn"));
    expect(normalize("tauhid")).toBe(normalize("tawhid"));
  });

  it("folds iy endings so wasi matches wasiyy exactly", () => {
    expect(normalize("waṣiyy")).toBe(normalize("wasi"));
    expect(normalize("waseey")).toBe(normalize("wasi"));
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

  it("matches a word inside a phrase entry", () => {
    const phraseIndex = buildSearchIndex([
      entry({ translit: "yawm al-qiyaamat", meaning: "day of resurrection" }),
    ]);
    const r = searchEntries("kiyamat", phraseIndex);
    expect(r[0]?.translit).toBe("yawm al-qiyaamat");
  });

  it("matches the query as a substring mid-word", () => {
    const r = searchEntries("haadat", index); // inside shahaadat
    expect(r.map((e) => e.translit)).toContain("shahaadat");
  });

  it("tightens fuzzy matching for short queries", () => {
    // "imom" (len 4) is distance 1 from "imam" -> still matches
    expect(searchEntries("imom", index).map((e) => e.translit)).toContain("imam");
    // "izm" is distance 2 from "imam" -> rejected at short-query threshold
    expect(searchEntries("izm", index).map((e) => e.translit)).not.toContain("imam");
  });
});
