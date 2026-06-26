import type { LlmCandidate, Confidence } from "./types";
import type { Settings } from "./settings";

const SYSTEM_PROMPT = `You help a Dawoodi Bohra user understand words and phrases heard during waaz
(sermons), delivered in Lisaan-ud-Dawat (Lisan al-Dawat): a Gujarati grammatical
base with heavy Arabic, Persian, and Urdu vocabulary, written in Arabic naskh
script, with short-vowel diacritics usually omitted. The waaz register is the
dense, Arabic-laden, theological end of the language, drawing on Quranic, Fatimi,
and Ismaili literature and the Karbala narrative.

The user types a rough, phonetic guess of what they heard. Their transliteration
is inconsistent and approximate. Identify the most likely intended word(s) or
phrase and explain the meaning in the sermon context.

Rules:
- The input is uncertain. If more than one interpretation is plausible, return
  2-3 ranked candidates rather than one overconfident answer.
- Prefer the sense used in a religious/sermon context.
- If you are not reasonably confident, lower the confidence field — do not
  fabricate. A flagged "low" is more useful than a wrong "high".
- Be especially cautious with Fatimi/Ismaili-specific meanings. If a term has a
  community-specific sense you are unsure of, say so in \`note\` and lower confidence.
- Keep meaning concise and usable in the moment.

Return ONLY valid JSON, no prose, no markdown:
{
  "candidates": [
    {
      "translit": "canonical romanization",
      "script": "Arabic-script form, or empty string if unsure",
      "meaning": "concise English meaning in sermon context",
      "root": "Arabic triliteral root if applicable, else empty",
      "note": "brief usage note; flag any Fatimi-specific uncertainty",
      "confidence": "high | medium | low"
    }
  ]
}`;

const API_URL = "https://api.anthropic.com/v1/messages";

// Structured-outputs schema: guarantees parseable JSON on models that support
// output_config.format (all KNOWN_MODELS). Custom/older models fall back to
// the prompt-instructed JSON + defensive parse below.
const CANDIDATES_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          translit: { type: "string" },
          script: { type: "string" },
          meaning: { type: "string" },
          root: { type: "string" },
          note: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["translit", "script", "meaning", "root", "note", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

/** Strip stray code fences and isolate the JSON object before parsing. */
function extractJson(text: string): string {
  let t = text.trim();
  // remove ```json ... ``` or ``` ... ``` fences
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // fall back to the outermost { ... } if extra prose slipped in
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t;
}

const VALID_CONFIDENCE: Confidence[] = ["high", "medium", "low"];

function coerceCandidate(raw: unknown): LlmCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const translit = typeof o.translit === "string" ? o.translit.trim() : "";
  const meaning = typeof o.meaning === "string" ? o.meaning.trim() : "";
  if (!translit && !meaning) return null;
  const confidence =
    typeof o.confidence === "string" &&
    VALID_CONFIDENCE.includes(o.confidence.toLowerCase() as Confidence)
      ? (o.confidence.toLowerCase() as Confidence)
      : "low";
  return {
    translit,
    script: typeof o.script === "string" ? o.script : "",
    meaning,
    root: typeof o.root === "string" ? o.root : "",
    note: typeof o.note === "string" ? o.note : "",
    confidence,
  };
}

async function callApi(
  query: string,
  settings: Settings,
  structured: boolean,
): Promise<Response> {
  return fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: query }],
      ...(structured
        ? { output_config: { format: { type: "json_schema", schema: CANDIDATES_SCHEMA } } }
        : {}),
    }),
  });
}

export async function askLlm(
  query: string,
  settings: Settings,
): Promise<LlmCandidate[]> {
  if (!settings.apiKey) {
    throw new Error("No API key set. Add one in Settings.");
  }

  let res = await callApi(query, settings, true);
  if (res.status === 400) {
    // custom/older model may not support output_config.format — retry plain
    res = await callApi(query, settings, false);
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err?.error?.message) detail = err.error.message;
    } catch {
      // keep status text
    }
    throw new Error(`Anthropic API error: ${detail}`);
  }

  const data = await res.json();
  const text: string =
    Array.isArray(data?.content) && data.content[0]?.type === "text"
      ? data.content[0].text
      : "";

  if (!text) throw new Error("Empty response from the model.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("Could not parse the model's response as JSON.");
  }

  const candidatesRaw = (parsed as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidatesRaw)) {
    throw new Error("Response did not contain a candidates array.");
  }

  const candidates = candidatesRaw
    .map(coerceCandidate)
    .filter((c): c is LlmCandidate => c !== null);

  if (candidates.length === 0) {
    throw new Error("The model returned no usable candidates.");
  }

  return candidates;
}
