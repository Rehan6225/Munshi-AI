import { formatINR } from "./format";
import type { Category, Transaction } from "./store";

/**
 * Munshi ji: the app's accountant persona. Replies are warm Hinglish, short enough
 * to read at a glance and to speak aloud.
 */
export type MunshiEvent =
  | {
      kind: "logged";
      spends: { amount: number; merchant: string; category: Category; learned: boolean }[];
    }
  | { kind: "rule"; merchant: string; category: Category; refiled: number }
  | { kind: "unused" | "cancel" | "used"; name: string; yearly: number }
  | { kind: "no-subscription"; name: string }
  | { kind: "not-understood" };

export interface MunshiReply {
  text: string;
  /** Optional nudge shown under the reply, e.g. about ordering a lot this week. */
  aside?: string;
}

/** Picks one of a few phrasings so Munshi doesn't sound like a robot. */
const pick = (options: string[], rng: () => number) => options[Math.floor(rng() * options.length)]!;

export function munshiReply(event: MunshiEvent, rng: () => number = Math.random): MunshiReply {
  switch (event.kind) {
    case "logged": {
      const [first] = event.spends;
      if (!first) return munshiReply({ kind: "not-understood" }, rng);
      if (event.spends.length > 1) {
        const total = event.spends.reduce((s, x) => s + x.amount, 0);
        return {
          text: pick(
            [
              `Done! ${event.spends.length} kharche likh diye, total ${formatINR(total)}.`,
              `Ho gaya! ${event.spends.length} entries, kul ${formatINR(total)}. Sab hisaab mein hai.`,
            ],
            rng,
          ),
        };
      }
      const learned = first.learned ? " Aapka rule yaad tha 🧠" : "";
      return {
        text:
          pick(
            [
              `Ho gaya! ${formatINR(first.amount)} ${first.merchant} pe likh diya, ${first.category} mein.`,
              `Likh liya! ${first.merchant}, ${formatINR(first.amount)}, ${first.category}.`,
            ],
            rng,
          ) + learned,
      };
    }
    case "rule":
      return {
        text:
          `Samajh gaya! Ab se ${event.merchant} hamesha ${event.category} mein jayega.` +
          (event.refiled ? ` Purane ${event.refiled} bhi theek kar diye.` : ""),
      };
    case "unused":
      return {
        text: `Theek hai, ${event.name} aap use nahi karte. Cancel kar dein? Saal ka ${formatINR(event.yearly)} bachega.`,
      };
    case "cancel":
      return {
        text: `${event.name} cancel list mein daal diya. Saal ke ${formatINR(event.yearly)} bach gaye! 🎉`,
      };
    case "used":
      return { text: `Noted, ${event.name} abhi chalu hai.` };
    case "no-subscription":
      return { text: `Hmm, ${event.name} naam ki koi subscription mujhe nahi mili.` };
    case "not-understood":
      return {
        text: "Maaf kijiye, samajh nahi aaya. Aise boliye: “480 Swiggy pe kharch kiye”.",
      };
  }
}

/**
 * A friendly heads-up when the same place keeps showing up this week,
 * e.g. the third Swiggy order. Only for spends people tend to cut.
 */
export function weeklyAside(
  merchant: string,
  category: Category,
  transactions: Transaction[],
  now = Date.now(),
): string | undefined {
  if (!["Food & Dining", "Shopping", "Entertainment"].includes(category)) return undefined;
  const key = merchant.toLowerCase();
  const thisWeek = transactions.filter(
    (t) => t.merchant.toLowerCase() === key && now - new Date(t.date).getTime() < 7 * 86400000,
  ).length;
  if (thisWeek < 3) return undefined;
  const nth = ["", "pehla", "doosra", "teesra", "chautha", "paanchva"][thisWeek] ?? `${thisWeek}th`;
  return `Is hafte yeh ${nth} ${merchant} order hai. Thoda dhyan rakhiye 😉`;
}

/** What Munshi says when you ask for today's summary on the dashboard. */
export function dailySummary({
  spend,
  income,
  topNudge,
}: {
  spend: number;
  income: number;
  topNudge?: string | undefined;
}) {
  const rate = income > 0 ? Math.max(0, Math.round(((income - spend) / income) * 100)) : null;
  return [
    `Namaste! Is mahine ab tak ${formatINR(spend)} kharch hue hain.`,
    rate === null
      ? ""
      : rate >= 30
        ? `Savings rate ${rate}% hai, bahut badhiya!`
        : `Savings rate ${rate}% hai, thoda aur bacha sakte hain.`,
    topNudge ? `Ek baat: ${topNudge}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Turns display text into something a speech engine reads naturally. */
export function toSpeech(text: string) {
  return text
    .replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n: string) => `${n.replace(/,/g, "")} rupaye`)
    .replace(/&/g, "and")
    .replace(/[“”"]/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
