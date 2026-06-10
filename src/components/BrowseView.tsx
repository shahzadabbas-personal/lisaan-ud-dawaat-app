import { useMemo, useState } from "react";
import type { Entry } from "../types";

interface Props {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
}

const UNTAGGED = "(untagged)";

export function BrowseView({ entries, onSelect }: Props) {
  const [theme, setTheme] = useState<string | null>(null);

  const themes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const tags = e.tags.length ? e.tags : [UNTAGGED];
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const shown = useMemo(() => {
    if (!theme) return [];
    return entries
      .filter((e) => (theme === UNTAGGED ? e.tags.length === 0 : e.tags.includes(theme)))
      .sort((a, b) => a.translit.localeCompare(b.translit));
  }, [entries, theme]);

  const verified = entries.filter((e) => e.verified).length;
  const topLookups = useMemo(
    () =>
      entries
        .filter((e) => e.lookupCount > 0)
        .sort((a, b) => b.lookupCount - a.lookupCount)
        .slice(0, 5),
    [entries],
  );
  const recent = useMemo(
    () => [...entries].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 5),
    [entries],
  );

  if (theme) {
    return (
      <div className="browse">
        <button className="ghost-btn back-btn" onClick={() => setTheme(null)} type="button">
          ← Themes
        </button>
        <h2 className="browse-heading">
          {theme} <span className="count">{shown.length}</span>
        </h2>
        <ul className="results">
          {shown.map((e) => (
            <li key={e.id}>
              <button className="result-row" onClick={() => onSelect(e)} type="button">
                <div className="result-main">
                  <span className="result-translit">{e.translit}</span>
                  {e.script && <span className="result-script">{e.script}</span>}
                </div>
                <div className="result-meaning">{e.meaning}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="browse">
      <h2 className="browse-heading">Themes</h2>
      <div className="theme-grid">
        {themes.map(([t, n]) => (
          <button key={t} className="theme-chip" onClick={() => setTheme(t)} type="button">
            {t} <span className="count">{n}</span>
          </button>
        ))}
      </div>

      <h2 className="browse-heading">Insights</h2>
      <div className="stat-row">
        {entries.length} words · {verified} verified (
        {entries.length ? Math.round((verified / entries.length) * 100) : 0}%)
      </div>

      {topLookups.length > 0 && (
        <>
          <h3 className="browse-subheading">Most looked up</h3>
          <ul className="mini-list">
            {topLookups.map((e) => (
              <li key={e.id}>
                <button className="mini-row" onClick={() => onSelect(e)} type="button">
                  <span className="result-translit">{e.translit}</span>
                  <span className="count">{e.lookupCount}×</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="browse-subheading">Recently added</h3>
      <ul className="mini-list">
        {recent.map((e) => (
          <li key={e.id}>
            <button className="mini-row" onClick={() => onSelect(e)} type="button">
              <span className="result-translit">{e.translit}</span>
              <span className="mini-meaning">{e.meaning}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
