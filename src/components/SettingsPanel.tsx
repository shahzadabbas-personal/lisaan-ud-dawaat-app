import { useState } from "react";
import { type Settings, DEFAULT_MODEL, KNOWN_MODELS, saveSettings } from "../settings";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

const CUSTOM = "__custom__";
const isKnown = (id: string) => KNOWN_MODELS.some((m) => m.id === id);

export function SettingsPanel({ settings, onChange }: Props) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  // dropdown selection: a known id, or the CUSTOM sentinel revealing a text field
  const [picker, setPicker] = useState(isKnown(settings.model) ? settings.model : CUSTOM);
  const [saved, setSaved] = useState(false);

  function save() {
    const next: Settings = { apiKey: apiKey.trim(), model: model.trim() || DEFAULT_MODEL };
    saveSettings(next);
    onChange(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="settings">
      <h2>Settings</h2>
      <label>
        Anthropic API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
      </label>
      <p className="hint">
        Stored only on this device (localStorage), sent directly to Anthropic.
        Set a spending limit on the key in the Anthropic console.
      </p>
      <label>
        Model
        <select
          value={picker}
          onChange={(e) => {
            const v = e.target.value;
            setPicker(v);
            if (v !== CUSTOM) setModel(v);
          }}
        >
          {KNOWN_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
      </label>
      {picker === CUSTOM && (
        <label>
          Custom model ID
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODEL}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      )}
      <button className="save-btn" onClick={save} type="button">
        {saved ? "Saved ✓" : "Save settings"}
      </button>
    </div>
  );
}
