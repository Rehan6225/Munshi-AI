import { createServerFn } from "@tanstack/react-start";
import { AI_SYSTEM_PROMPT } from "./voice";

interface ParseInput {
  text: string;
  merchants: string[];
  subscriptions: string[];
  today: string;
}

export type AiParseResult =
  { ok: true; json: string } | { ok: false; reason: "no-key" | "error"; message?: string };

/**
 * Runs on the server so GEMINI_API_KEY never reaches the browser. Returns the model's raw
 * JSON text; the client parses and validates it with sanitizeAiParse() and falls back to the local parser.
 */
export const parseVoiceWithAi = createServerFn({ method: "POST" })
  .inputValidator((d: ParseInput) => ({
    text: String(d.text).slice(0, 1000),
    merchants: (d.merchants ?? []).slice(0, 200).map(String),
    subscriptions: (d.subscriptions ?? []).slice(0, 50).map(String),
    today: String(d.today),
  }))
  .handler(async ({ data }): Promise<AiParseResult> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false, reason: "no-key" };
    const model = process.env["GEMINI_MODEL"] || "gemini-flash-latest";

    const prompt = [
      `Today is ${data.today}.`,
      `Known merchants: ${data.merchants.join(", ") || "none yet"}.`,
      `Subscriptions: ${data.subscriptions.join(", ") || "none"}.`,
      `Text: ${JSON.stringify(data.text)}`,
    ].join("\n");

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!res.ok) {
        return {
          ok: false,
          reason: "error",
          message: `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`,
        };
      }
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      JSON.parse(text); // fail here, with a clear message, if the model didn't return JSON
      return { ok: true, json: text };
    } catch (e) {
      return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
    }
  });
