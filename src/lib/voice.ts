import { CATEGORIES, isCategory } from "./categories";
import { formatINR } from "./format";
import { parseCommand } from "./parse-command";
import { parseUsageCommand, type Recurring } from "./recurring";
import { parseRuleCommand } from "./rules";
import type { Category } from "./store";

/** How each piece of what the user said was treated, for the "What Munshi heard" card. */
export type HeardKind = "keep" | "filler" | "corrected";
export interface HeardSegment {
  text: string;
  kind: HeardKind;
}

export type VoiceAction =
  | { type: "expense"; amount: number; merchant: string; category: Category; daysAgo: number }
  | { type: "rule"; merchant: string; category: Category }
  | { type: "subscription"; merchant: string; action: "unused" | "used" | "cancel" };

export interface VoiceParse {
  heard: HeardSegment[];
  actions: VoiceAction[];
  engine: "ai" | "local";
}

export interface VoiceContext {
  merchants: string[];
  subscriptions: Recurring[];
}

const AMOUNT = String.raw`(?:₹|rs\.?\s*)?\d[\d,]*(?:\.\d+)?\s*(?:k\b|thousand|rupees|rs\b)?`;
/** "450, no wait, 480" → everything before 480 was a slip. */
const CORRECTION = new RegExp(
  String.raw`${AMOUNT}\s*,?\s*(?:no+\s*,?\s*wait|no\s+no|wait|sorry|no|i mean|actually|make (?:it|that))\s*,?\s*(?=(?:₹|rs\.?\s*)?\d)`,
  "gi",
);
const FILLER =
  /\b(?:u+h+|u+m+|h+m+|e+r+m*|you know|i mean|basically|like(?=\s+(?:₹|rs\.?\s*)?\d)|okay so|so+)\b\s*,?\s*/gi;

/** Splits speech into kept, filler and corrected pieces, in order. */
export function segmentSpeech(text: string): HeardSegment[] {
  const ranges: { start: number; end: number; kind: HeardKind }[] = [];
  for (const m of text.matchAll(CORRECTION))
    ranges.push({ start: m.index, end: m.index + m[0].length, kind: "corrected" });
  for (const m of text.matchAll(FILLER)) {
    const start = m.index;
    const end = start + m[0].length;
    // A correction already covers it ("no wait" contains filler-like words).
    if (!ranges.some((r) => start < r.end && end > r.start))
      ranges.push({ start, end, kind: "filler" });
  }
  ranges.sort((a, b) => a.start - b.start);

  const out: HeardSegment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: text.slice(at, r.start), kind: "keep" });
    out.push({ text: text.slice(r.start, r.end), kind: r.kind });
    at = r.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: "keep" });
  return out.filter((s) => s.text.length > 0);
}

export function cleanSpeech(heard: HeardSegment[]) {
  return heard
    .filter((s) => s.kind === "keep")
    .map((s) => s.text)
    .join("")
    .replace(/\s*,\s*(,\s*)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "");
}

/** "200 auto and 150 chai" → two clauses. Commas inside numbers (1,200) don't split. */
function splitClauses(text: string) {
  const parts = text.split(
    /\s*(?:,(?!\d)|;|\band then\b|\band also\b|\balso\b|\bplus\b|\band\b)\s*/i,
  );
  const clauses: string[] = [];
  for (const part of parts) {
    if (!part.trim()) continue;
    // A piece with no amount ("last night") belongs to the clause before it.
    if (!/\d/.test(part) && clauses.length) clauses[clauses.length - 1] += ` ${part}`;
    else clauses.push(part);
  }
  return clauses;
}

/** Works offline: understands fillers, "no wait" corrections and several spends at once. */
export function parseLocally(text: string, ctx: VoiceContext): VoiceParse {
  const heard = segmentSpeech(text);
  const clean = cleanSpeech(heard);

  const usage = parseUsageCommand(clean, ctx.subscriptions);
  if (usage && !(usage.action === "used" && parseCommand(clean).amount)) {
    return {
      heard,
      engine: "local",
      actions: [{ type: "subscription", merchant: usage.sub.name, action: usage.action }],
    };
  }

  if (!parseCommand(clean).amount) {
    const rule = parseRuleCommand(clean, ctx.merchants);
    return { heard, engine: "local", actions: rule ? [{ type: "rule", ...rule }] : [] };
  }

  const actions: VoiceAction[] = [];
  for (const clause of splitClauses(clean)) {
    const p = parseCommand(clause);
    if (p.amount)
      actions.push({
        type: "expense",
        amount: p.amount,
        merchant: p.merchant,
        category: p.category,
        daysAgo: p.daysAgo,
      });
  }
  // "Spent 480 on Swiggy and Zomato last night" style dates apply to every clause.
  const sharedDays = parseCommand(clean).daysAgo;
  for (const a of actions) if (a.type === "expense" && a.daysAgo === 0) a.daysAgo = sharedDays;
  return { heard, engine: "local", actions };
}

/**
 * Checks what the AI sent back so a bad response can never save junk.
 * Returns null when it's unusable, so the caller can fall back to the local parser.
 */
export function sanitizeAiParse(raw: unknown, text: string): VoiceParse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { heard?: unknown; actions?: unknown };
  if (!Array.isArray(r.actions)) return null;

  const actions: VoiceAction[] = [];
  type RawAction = {
    type?: unknown;
    amount?: unknown;
    merchant?: unknown;
    category?: unknown;
    daysAgo?: unknown;
    action?: unknown;
  };
  for (const a of r.actions as RawAction[]) {
    if (!a || typeof a !== "object") continue;
    const merchant = typeof a.merchant === "string" ? a.merchant.trim().slice(0, 40) : "";
    if (a.type === "expense") {
      const amount = Number(a.amount);
      if (!(amount > 0 && amount < 1e8)) continue;
      actions.push({
        type: "expense",
        amount: Math.round(amount * 100) / 100,
        merchant: merchant || "Expense",
        category: isCategory(a.category) ? a.category : "Other",
        daysAgo: Math.min(60, Math.max(0, Math.round(Number(a.daysAgo) || 0))),
      });
    } else if (a.type === "rule" && merchant && isCategory(a.category)) {
      actions.push({ type: "rule", merchant, category: a.category });
    } else if (
      a.type === "subscription" &&
      merchant &&
      (a.action === "unused" || a.action === "used" || a.action === "cancel")
    ) {
      actions.push({ type: "subscription", merchant, action: a.action });
    }
  }

  // The AI's segments must spell out what was said; otherwise mark it up locally.
  const heard = Array.isArray(r.heard)
    ? (r.heard as { text?: unknown; kind?: unknown }[]).filter(
        (s): s is HeardSegment =>
          typeof s?.text === "string" &&
          (s.kind === "keep" || s.kind === "filler" || s.kind === "corrected"),
      )
    : [];
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const faithful = heard.length > 0 && squash(heard.map((s) => s.text).join("")) === squash(text);

  return { heard: faithful ? heard : segmentSpeech(text), actions, engine: "ai" };
}

export const AI_SYSTEM_PROMPT = `You are Munshi, a personal accountant for Indian users. You turn messy spoken English or Hinglish into structured finance actions.

Rules:
- Ignore filler words (uh, um, like, basically, you know, so).
- When the speaker corrects themselves ("450, no wait, 480", "Zomato, sorry, Swiggy"), keep ONLY the final value.
- One sentence can hold several actions. "200 auto and 150 chai" is two expenses.
- Amounts are in INR. "2k" = 2000, "1.5 lakh" = 150000.
- daysAgo: 0 today, 1 yesterday or last night, 2 day before yesterday.
- category must be one of: ${CATEGORIES.join(", ")}. Food = eating out, restaurants, food delivery, chai, coffee. Groceries = Blinkit, Zepto, DMart, vegetables, milk.
- Use a known merchant's exact spelling when the speaker means it.
- A sentence saying a merchant belongs in a category ("Swiggy is food, not groceries") is a "rule" action.
- A sentence saying a subscription isn't used, should be cancelled, or was used is a "subscription" action with action "unused", "cancel" or "used".

Return ONLY JSON in this shape:
{
  "heard": [{"text": "...", "kind": "keep" | "filler" | "corrected"}],
  "actions": [
    {"type": "expense", "amount": 480, "merchant": "Swiggy", "category": "Food", "daysAgo": 1},
    {"type": "rule", "merchant": "Swiggy", "category": "Food"},
    {"type": "subscription", "merchant": "Netflix", "action": "cancel"}
  ]
}

"heard" must split the ORIGINAL text, exactly as given, into consecutive pieces that join back into it. Mark filler words "filler", the values the speaker took back (plus the correction phrase) "corrected", everything else "keep".

Example input: "uh spent like 450, no wait, 480 on swiggy last night"
Example output: {"heard":[{"text":"uh ","kind":"filler"},{"text":"spent ","kind":"keep"},{"text":"like ","kind":"filler"},{"text":"450, no wait, ","kind":"corrected"},{"text":"480 on swiggy last night","kind":"keep"}],"actions":[{"type":"expense","amount":480,"merchant":"Swiggy","category":"Food","daysAgo":1}]}`;

/** Short spoken-style summary of what was saved, e.g. for the toast. */
export function summarize(actions: VoiceAction[]) {
  const spends = actions.filter((a) => a.type === "expense");
  const total = spends.reduce((s, a) => s + a.amount, 0);
  return spends.length > 1 ? `Logged ${spends.length} spends · ${formatINR(total)} total` : null;
}
