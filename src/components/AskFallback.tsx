import { useState } from "react";
import { askLlm } from "../llm";
import type { LlmCandidate } from "../types";
import type { Settings } from "../settings";

interface Props {
  query: string;
  settings: Settings;
  onSave: (candidate: LlmCandidate) => Promise<void>;
}

export function AskFallback({ query, settings, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LlmCandidate[] | null>(null);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());

  async function ask() {
    setLoading(true);
    setError(null);
    setCandidates(null);
    setSavedIdx(new Set());
    try {
      const res = await askLlm(query.trim(), settings);
      setCandidates(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function save(c: LlmCandidate, idx: number) {
    await onSave(c);
    setSavedIdx((prev) => new Set(prev).add(idx));
  }

  return (
    <div className="ask">
      <button className="ask-btn" onClick={ask} disabled={loading} type="button">
        {loading ? "Asking…" : "Ask AI"}
      </button>

      {error && <div className="ask-error">{error}</div>}

      {candidates && (
        <ul className="ask-results">
          {candidates.map((c, i) => (
            <li key={i} className="ask-card">
              <div className="result-main">
                <span className="result-translit">{c.translit}</span>
                {c.script && <span className="result-script">{c.script}</span>}
                <span className={`badge conf-${c.confidence}`}>{c.confidence}</span>
              </div>
              <div className="result-meaning">{c.meaning}</div>
              {c.root && <div className="field-row">root: {c.root}</div>}
              {c.note && <div className="field-row note">{c.note}</div>}
              <button
                className="save-btn"
                onClick={() => save(c, i)}
                disabled={savedIdx.has(i)}
                type="button"
              >
                {savedIdx.has(i) ? "Saved ✓" : "Save"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
