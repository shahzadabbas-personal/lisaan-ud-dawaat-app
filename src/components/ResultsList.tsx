import type { Entry } from "../types";

interface Props {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
}

export function ResultsList({ entries, onSelect }: Props) {
  if (entries.length === 0) return null;
  return (
    <ul className="results">
      {entries.map((e) => (
        <li key={e.id}>
          <button className="result-row" onClick={() => onSelect(e)} type="button">
            <div className="result-main">
              <span className="result-translit">{e.translit}</span>
              {e.script && <span className="result-script">{e.script}</span>}
            </div>
            <div className="result-meaning">{e.meaning}</div>
            {!e.verified && <span className="badge unverified">unverified</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
