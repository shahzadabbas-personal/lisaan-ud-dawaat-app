import { useState } from "react";
import type { Entry } from "../types";

interface Props {
  entry: Entry;
  isNew?: boolean;
  onSave: (entry: Entry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const csv = (arr: string[]) => arr.join(", ");
const parseCsv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function EntryCard({ entry, isNew = false, onSave, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState<Entry>(entry);

  function set<K extends keyof Entry>(key: K, value: Entry[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    if (!draft.translit.trim() || !draft.meaning.trim()) return;
    await onSave(draft);
    if (isNew) onClose();
    else setEditing(false);
  }

  async function toggleVerified() {
    const updated = { ...draft, verified: !draft.verified };
    setDraft(updated);
    await onSave(updated);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close" type="button">
          ✕
        </button>

        {editing ? (
          <div className="edit-form">
            <h2>{isNew ? "Add entry" : "Edit entry"}</h2>
            <label>
              Translit *
              <input value={draft.translit} onChange={(e) => set("translit", e.target.value)} />
            </label>
            <label>
              Meaning *
              <textarea value={draft.meaning} onChange={(e) => set("meaning", e.target.value)} rows={2} />
            </label>
            <label>
              Script
              <input value={draft.script} onChange={(e) => set("script", e.target.value)} dir="rtl" />
            </label>
            <label>
              Root
              <input value={draft.root} onChange={(e) => set("root", e.target.value)} dir="rtl" />
            </label>
            <label>
              Heard forms (comma-separated)
              <input value={csv(draft.heardForms)} onChange={(e) => set("heardForms", parseCsv(e.target.value))} />
            </label>
            <label>
              Tags (comma-separated)
              <input value={csv(draft.tags)} onChange={(e) => set("tags", parseCsv(e.target.value))} />
            </label>
            <label>
              Note
              <textarea value={draft.note} onChange={(e) => set("note", e.target.value)} rows={2} />
            </label>
            <label>
              Context heard
              <input value={draft.contextHeard} onChange={(e) => set("contextHeard", e.target.value)} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={draft.verified} onChange={(e) => set("verified", e.target.checked)} />
              Verified
            </label>
            <div className="modal-actions">
              <button className="save-btn" onClick={handleSave} type="button">
                Save
              </button>
              {!isNew && (
                <button className="ghost-btn" onClick={() => { setDraft(entry); setEditing(false); }} type="button">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="entry-view">
            <div className="result-main">
              <span className="result-translit big">{draft.translit}</span>
              {draft.script && <span className="result-script big">{draft.script}</span>}
            </div>
            <p className="entry-meaning">{draft.meaning}</p>
            {draft.root && <div className="field-row">root: {draft.root}</div>}
            {draft.note && <div className="field-row note">{draft.note}</div>}
            {draft.heardForms.length > 0 && (
              <div className="field-row">heard: {draft.heardForms.join(", ")}</div>
            )}
            {draft.tags.length > 0 && (
              <div className="tag-row">
                {draft.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}
            {draft.contextHeard && <div className="field-row">context: {draft.contextHeard}</div>}
            <div className="field-row meta">
              {draft.source} · looked up {draft.lookupCount}× ·{" "}
              {draft.verified ? "verified" : "unverified"}
            </div>
            <div className="modal-actions">
              <button className={draft.verified ? "ghost-btn" : "save-btn"} onClick={toggleVerified} type="button">
                {draft.verified ? "Unverify" : "Verify ✓"}
              </button>
              <button className="ghost-btn" onClick={() => setEditing(true)} type="button">
                Edit
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  if (confirm(`Delete "${draft.translit}"?`)) onDelete(draft.id);
                }}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
