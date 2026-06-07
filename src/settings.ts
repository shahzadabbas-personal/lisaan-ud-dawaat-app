export interface Settings {
  apiKey: string;
  model: string;
}

const KEY = "waaz-settings";

// Cheapest first — Haiku is the right default for in-the-moment word lookup.
export const KNOWN_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest, cheapest" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — most capable, priciest" },
] as const;

export const DEFAULT_MODEL = "claude-haiku-4-5";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        apiKey: parsed.apiKey ?? "",
        model: parsed.model || DEFAULT_MODEL,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { apiKey: "", model: DEFAULT_MODEL };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
