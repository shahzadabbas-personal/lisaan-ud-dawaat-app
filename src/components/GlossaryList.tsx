import { useMemo, useState } from "react";
import type { Entry } from "../types";

interface Props {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
}

type Sort = "recent" | "lookups" | "alpha";

export function GlossaryList({ entries, onSelect }: Props) {
  const [sort, setSort] = useState<Sort>("recent");
  const [tag, setTag] = useState<string>("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [entries]);

  const shown = useMemo(() => {
    let list = tag ? entries.filter((e) => e.tags.includes(tag)) : entries.slice();
    list.sort((a, b) => {
      if (sort === "lookups") return b.lookupCount - a.lookupCount;
      if (sort === "alpha") return a.translit.localeCompare(b.translit);
      return b.dateAdded - a.dateAdded;
    });
    return list;
  }, [entries, sort, tag]);

  return (
    <div className="glossary">
      <div className="glossary-controls">
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Most recent</option>
          <option value="lookups">Most looked-up</option>
          <option value="alpha">A–Z</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="count">{shown.length}</span>
      </div>
      <ul className="results">
        {shown.map((e) => (
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
    </div>
  );
}
