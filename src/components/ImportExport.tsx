import { useRef, useState } from "react";
import { exportGlossary, importGlossary, dedupeGlossary } from "../importExport";

interface Props {
  onImported: () => void;
}

export function ImportExport({ onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    try {
      const text = await file.text();
      const n = await importGlossary(text);
      setMsg(`Imported ${n} entries.`);
      onImported();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDedupe() {
    setMsg(null);
    try {
      const n = await dedupeGlossary();
      setMsg(n === 0 ? "No duplicates found." : `Removed ${n} duplicate entries.`);
      if (n > 0) onImported();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Dedupe failed.");
    }
  }

  return (
    <div className="importexport">
      <h2>Backup</h2>
      <p className="hint">
        iOS can evict a PWA's storage. Export regularly — this glossary is
        irreplaceable once built up.
      </p>
      <div className="modal-actions">
        <button className="save-btn" onClick={() => exportGlossary()} type="button">
          Export JSON
        </button>
        <button className="ghost-btn" onClick={() => fileRef.current?.click()} type="button">
          Import JSON
        </button>
        <button className="ghost-btn" onClick={handleDedupe} type="button">
          Remove duplicates
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
      {msg && <div className="field-row">{msg}</div>}
    </div>
  );
}
