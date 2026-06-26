import { useEffect, useMemo, useState } from "react";
import type { Entry, LlmCandidate } from "./types";
import {
  getAllEntries,
  putEntry,
  deleteEntry,
  incrementLookup,
  makeEntry,
} from "./db";
import { loadSeedIfEmpty } from "./seed";
import { buildSearchIndex, searchEntries } from "./search";
import { askLlm } from "./llm";
import { loadSettings, type Settings } from "./settings";
import { CaptureBar } from "./components/CaptureBar";
import { ResultsList } from "./components/ResultsList";
import { AskResults } from "./components/AskResults";
import { EntryCard } from "./components/EntryCard";
import { GlossaryList } from "./components/GlossaryList";
import { BrowseView } from "./components/BrowseView";
import { SettingsPanel } from "./components/SettingsPanel";
import { ImportExport } from "./components/ImportExport";

type View = "home" | "browse" | "glossary" | "data";

interface Selected {
  entry: Entry;
  isNew: boolean;
}

function blankEntry(): Entry {
  return makeEntry({ translit: "", meaning: "", source: "manual" });
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askCandidates, setAskCandidates] = useState<LlmCandidate[] | null>(null);

  async function reload() {
    setEntries(await getAllEntries());
  }

  useEffect(() => {
    (async () => {
      await loadSeedIfEmpty();
      await reload();
      setReady(true);
    })();
  }, []);

  const index = useMemo(() => buildSearchIndex(entries), [entries]);
  const results = useMemo(
    () => (query.trim() ? searchEntries(query, index) : []),
    [query, index],
  );

  // Stale AI candidates belong to the previous guess — clear them as the user types.
  useEffect(() => {
    setAskCandidates(null);
    setAskError(null);
  }, [query]);

  async function runAsk() {
    if (!query.trim()) return;
    setAskLoading(true);
    setAskError(null);
    setAskCandidates(null);
    try {
      setAskCandidates(await askLlm(query.trim(), settings));
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAskLoading(false);
    }
  }

  async function openEntry(entry: Entry) {
    await incrementLookup(entry.id);
    await reload();
    setSelected({ entry: { ...entry, lookupCount: entry.lookupCount + 1 }, isNew: false });
  }

  async function handleSave(entry: Entry) {
    await putEntry(entry);
    await reload();
    setSelected((s) => (s && !s.isNew ? { entry, isNew: false } : s));
  }

  async function handleDelete(id: string) {
    await deleteEntry(id);
    await reload();
    setSelected(null);
  }

  async function saveCandidate(c: LlmCandidate) {
    const entry = makeEntry({
      translit: c.translit,
      meaning: c.meaning,
      script: c.script,
      root: c.root,
      note: c.note,
      heardForms: query.trim() ? [query.trim()] : [],
      source: "llm",
      verified: false,
    });
    await putEntry(entry);
    await reload();
  }

  if (!ready) {
    return <div className="loading">Loading glossary…</div>;
  }

  return (
    <div className="app">
      <main className="content">
        {view === "home" && (
          <>
            <div className="home-head">
              <div className="search-row">
                <CaptureBar
                  query={query}
                  onChange={setQuery}
                  onSubmit={() => {
                    if (results[0]) openEntry(results[0]);
                  }}
                />
                <button
                  className="ask-compact"
                  onClick={runAsk}
                  disabled={!query.trim() || askLoading}
                  type="button"
                >
                  {askLoading ? "✦ …" : "✦ Ask AI"}
                </button>
              </div>
            </div>
            <ResultsList entries={results} onSelect={openEntry} />
            {query.trim() && results.length === 0 && !askCandidates && !askError && (
              <p className="empty-hint">No local match — ask the AI.</p>
            )}
            <AskResults error={askError} candidates={askCandidates} onSave={saveCandidate} />
            {!query.trim() && (
              <p className="empty-hint">
                {entries.length} words in your glossary. Start typing what you heard.
              </p>
            )}
          </>
        )}

        {view === "browse" && (
          <BrowseView entries={entries} onSelect={openEntry} />
        )}

        {view === "glossary" && (
          <GlossaryList entries={entries} onSelect={openEntry} />
        )}

        {view === "data" && (
          <>
            <SettingsPanel settings={settings} onChange={setSettings} />
            <ImportExport onImported={reload} />
          </>
        )}
      </main>

      <button
        className="fab"
        onClick={() => setSelected({ entry: blankEntry(), isNew: true })}
        aria-label="Add entry"
        type="button"
      >
        +
      </button>

      <nav className="tabbar">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")} type="button">
          Search
        </button>
        <button className={view === "browse" ? "active" : ""} onClick={() => setView("browse")} type="button">
          Browse
        </button>
        <button className={view === "glossary" ? "active" : ""} onClick={() => setView("glossary")} type="button">
          Glossary
        </button>
        <button className={view === "data" ? "active" : ""} onClick={() => setView("data")} type="button">
          Settings
        </button>
      </nav>

      {selected && (
        <EntryCard
          entry={selected.entry}
          isNew={selected.isNew}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
