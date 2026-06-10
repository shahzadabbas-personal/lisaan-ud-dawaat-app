import { useEffect, useRef } from "react";

interface Props {
  query: string;
  onChange: (q: string) => void;
  onSubmit?: () => void;
}

export function CaptureBar({ query, onChange, onSubmit }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  // Always land the cursor in the box on open — capture is the whole point.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="capture-wrap">
      <input
        ref={ref}
        className="capture"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
        enterKeyHint="go"
        placeholder="Type what you heard…"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search heard word"
      />
      {query && (
        <button
          className="capture-clear"
          onClick={() => onChange("")}
          aria-label="Clear"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}
