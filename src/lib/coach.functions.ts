import { createServerFn } from "@tanstack/react-start";
import { COACH_SYSTEM_PROMPT } from "./coach";
import { asksForSecurities, namesSecurities } from "./guardrails";

interface AskInput {
  question: string;
  /** Earlier turns, oldest first, so follow-ups make sense. */
  history: { role: "user" | "munshi"; text: string }[];
  /** JSON of the CoachSnapshot: the only numbers the model may use. */
  snapshot: string;
}

export type CoachResult =
  | { ok: true; answer: string }
  | { ok: false; reason: "no-key" | "guardrail" | "error"; message?: string };

/**
 * Runs on the server so GEMINI_API_KEY never reaches the browser. Guardrails run here too:
 * on the question before calling the model, and on the answer before returning it.
 */
export const askCoach = createServerFn({ method: "POST" })
  .inputValidator((d: AskInput) => ({
    question: String(d.question).slice(0, 600),
    history: (d.history ?? []).slice(-6).map((h) => ({
      role: h.role === "munshi" ? ("munshi" as const) : ("user" as const),
      text: String(h.text).slice(0, 800),
    })),
    snapshot: String(d.snapshot).slice(0, 12000),
  }))
  .handler(async ({ data }): Promise<CoachResult> => {
    if (asksForSecurities(data.question)) return { ok: false, reason: "guardrail" };
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false, reason: "no-key" };
    const model = process.env["GEMINI_MODEL"] || "gemini-flash-latest";

    const contents = [
      ...data.history.map((h) => ({
        role: h.role === "munshi" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
      {
        role: "user",
        parts: [
          { text: `My money snapshot (JSON):\n${data.snapshot}\n\nQuestion: ${data.question}` },
        ],
      },
    ];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: COACH_SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
          }),
          signal: AbortSignal.timeout(15000),
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
      const answer = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!answer) return { ok: false, reason: "error", message: "Empty answer" };
      // Belt and braces: never show an answer that names a specific investment.
      if (namesSecurities(answer)) return { ok: false, reason: "guardrail" };
      return { ok: true, answer };
    } catch (e) {
      return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
    }
  });
