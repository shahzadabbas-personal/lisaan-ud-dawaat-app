export type EntrySource = "seeded" | "llm" | "manual";

export interface Entry {
  id: string; // uuid
  translit: string; // canonical romanization, e.g. "waṣiyy"
  heardForms: string[]; // rough phonetic guesses typed for this word
  script: string; // Arabic-script LDB form; may be "" if unknown
  meaning: string; // English definition
  root: string; // Arabic triliteral root if applicable, else ""
  note: string; // usage in sermon/religious context
  tags: string[]; // e.g. ["karbala"], ["theology"]
  source: EntrySource;
  verified: boolean; // false until confirmed in real use
  lookupCount: number; // increment on each successful lookup
  contextHeard: string; // optional: which day/waaz it was heard
  dateAdded: number; // epoch ms
  searchKey: string; // precomputed normalized key (translit-based)
}

export type Confidence = "high" | "medium" | "low";

export interface LlmCandidate {
  translit: string;
  script: string;
  meaning: string;
  root: string;
  note: string;
  confidence: Confidence;
}
