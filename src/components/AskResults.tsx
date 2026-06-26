import { useEffect, useState } from "react";
import type { LlmCandidate } from "../types";

interface Props {
  error: string | null;
  candidates: LlmCandidate[] | null;
  onSave: (candidate: LlmCandidate) => Promise<void>;
}

/** Renders the AI fallback output (error + ranked candidates). The trigger
 *  (the "Ask AI" button) lives in the sticky search row in App. */
export function AskResults({ error, candidates, onSave }: Props) {
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());

  // A fresh ask replaces the candidate set — reset the saved markers with it.
  useEffect(() => setSavedIdx(new Set()), [candidates]);

  async function save(c: LlmCandidate, idx: number) {
    await onSave(c);
    setSavedIdx((prev) => new Set(prev).add(idx));
  }

  if (!error && !candidates) return null;

  return (
    <div className="ask">
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
