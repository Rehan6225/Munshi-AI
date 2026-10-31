import { formatINR } from "./format";
import type { Category, Transaction } from "./store";

/**
 * Munshi ji: the app's accountant persona. Every line comes twice: Hinglish in Latin
 * letters to read on screen, and the same sentence in Devanagari for a Hindi voice to
 * speak. English voices mangle Romanised Hindi ("likh diya"); Hindi voices read
 * Devanagari properly and handle the English words mixed in.
 */
export interface Line {
  text: string;
  hindi: string;
}

export type MunshiEvent =
  | {
      kind: "logged";
      spends: { amount: number; merchant: string; category: Category; learned: boolean }[];
    }
  | { kind: "rule"; merchant: string; category: Category; refiled: number }
  | { kind: "unused" | "cancel" | "used"; name: string; yearly: number }
  | { kind: "no-subscription"; name: string }
  | { kind: "not-understood" };

export interface MunshiReply extends Line {
  /** Optional nudge shown under the reply, e.g. about ordering a lot this week. */
  aside?: Line | undefined;
}

/** Amount as a Hindi voice should say it: digits it reads in Hindi, then "rupaye". */
const rupees = (n: number) => `${Math.round(n)} रुपये`;

/** Picks one of a few phrasings so Munshi doesn't sound like a robot. */
const pick = (options: Line[], rng: () => number) => options[Math.floor(rng() * options.length)]!;

const join = (...lines: (Line | false | undefined)[]): Line => {
  const kept = lines.filter((l): l is Line => !!l);
  return { text: kept.map((l) => l.text).join(" "), hindi: kept.map((l) => l.hindi).join(" ") };
};

export function munshiReply(event: MunshiEvent, rng: () => number = Math.random): MunshiReply {
  switch (event.kind) {
    case "logged": {
      const [first] = event.spends;
      if (!first) return munshiReply({ kind: "not-understood" }, rng);
      if (event.spends.length > 1) {
        const n = event.spends.length;
        const total = event.spends.reduce((s, x) => s + x.amount, 0);
        return pick(
          [
            {
              text: `Done! ${n} kharche likh diye, total ${formatINR(total)}.`,
              hindi: `डन! ${n} खर्चे लिख दिए, टोटल ${rupees(total)}।`,
            },
            {
              text: `Ho gaya! ${n} entries, kul ${formatINR(total)}. Sab hisaab mein hai.`,
              hindi: `हो गया! ${n} एंट्रीज़, कुल ${rupees(total)}। सब हिसाब में है।`,
            },
          ],
          rng,
        );
      }
      const { amount, merchant, category } = first;
      return join(
        pick(
          [
            {
              text: `Ho gaya! ${formatINR(amount)} ${merchant} pe likh diya, ${category} mein.`,
              hindi: `हो गया! ${rupees(amount)} ${merchant} पे लिख दिया, ${category} में।`,
            },
            {
              text: `Likh liya! ${merchant}, ${formatINR(amount)}, ${category}.`,
              hindi: `लिख लिया! ${merchant}, ${rupees(amount)}, ${category}।`,
            },
          ],
          rng,
        ),
        first.learned && { text: "Aapka rule yaad tha 🧠", hindi: "आपका रूल याद था।" },
      );
    }
    case "rule":
      return join(
        {
          text: `Samajh gaya! Ab se ${event.merchant} hamesha ${event.category} mein jayega.`,
          hindi: `समझ गया! अब से ${event.merchant} हमेशा ${event.category} में जाएगा।`,
        },
        event.refiled > 0 && {
          text: `Purane ${event.refiled} bhi theek kar diye.`,
          hindi: `पुराने ${event.refiled} भी ठीक कर दिए।`,
        },
      );
    case "unused":
      return {
        text: `Theek hai, ${event.name} aap use nahi karte. Cancel kar dein? Saal ka ${formatINR(event.yearly)} bachega.`,
        hindi: `ठीक है, ${event.name} आप यूज़ नहीं करते। कैंसल कर दें? साल का ${rupees(event.yearly)} बचेगा।`,
      };
    case "cancel":
      return {
        text: `${event.name} cancel list mein daal diya. Saal ke ${formatINR(event.yearly)} bach gaye! 🎉`,
        hindi: `${event.name} कैंसल लिस्ट में डाल दिया। साल के ${rupees(event.yearly)} बच गए!`,
      };
    case "used":
      return {
        text: `Noted, ${event.name} abhi chalu hai.`,
        hindi: `नोटेड, ${event.name} अभी चालू है।`,
      };
    case "no-subscription":
      return {
        text: `Hmm, ${event.name} naam ki koi subscription mujhe nahi mili.`,
        hindi: `हम्म, ${event.name} नाम की कोई सब्सक्रिप्शन मुझे नहीं मिली।`,
      };
    case "not-understood":
      return {
        text: "Maaf kijiye, samajh nahi aaya. Aise boliye: “480 Swiggy pe kharch kiye”.",
        hindi: "माफ़ कीजिए, समझ नहीं आया। ऐसे बोलिए: चार सौ अस्सी, Swiggy पे खर्च किए।",
      };
  }
}

const NTH = [
  ["", ""],
  ["pehla", "पहला"],
  ["doosra", "दूसरा"],
  ["teesra", "तीसरा"],
  ["chautha", "चौथा"],
  ["paanchva", "पाँचवाँ"],
];

/**
 * A friendly heads-up when the same place keeps showing up this week,
 * e.g. the third Swiggy order. Only for spends people tend to cut.
 */
export function weeklyAside(
  merchant: string,
  category: Category,
  transactions: Transaction[],
  now = Date.now(),
): Line | undefined {
  if (!["Food & Dining", "Shopping", "Entertainment"].includes(category)) return undefined;
  const key = merchant.toLowerCase();
  const thisWeek = transactions.filter(
    (t) => t.merchant.toLowerCase() === key && now - new Date(t.date).getTime() < 7 * 86400000,
  ).length;
  if (thisWeek < 3) return undefined;
  const [nth, nthHi] = NTH[thisWeek] ?? [`${thisWeek}th`, `${thisWeek}वाँ`];
  return {
    text: `Is hafte yeh ${nth} ${merchant} order hai. Thoda dhyan rakhiye 😉`,
    hindi: `इस हफ़्ते ये ${nthHi} ${merchant} ऑर्डर है। थोड़ा ध्यान रखिए।`,
  };
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
}): Line {
  const rate = income > 0 ? Math.max(0, Math.round(((income - spend) / income) * 100)) : null;
  return join(
    {
      text: `Namaste! Is mahine ab tak ${formatINR(spend)} kharch hue hain.`,
      hindi: `नमस्ते! इस महीने अब तक ${rupees(spend)} खर्च हुए हैं।`,
    },
    rate !== null &&
      (rate >= 30
        ? {
            text: `Savings rate ${rate}% hai, bahut badhiya!`,
            hindi: `सेविंग्स रेट ${rate} प्रतिशत है, बहुत बढ़िया!`,
          }
        : {
            text: `Savings rate ${rate}% hai, thoda aur bacha sakte hain.`,
            hindi: `सेविंग्स रेट ${rate} प्रतिशत है, थोड़ा और बचा सकते हैं।`,
          }),
    // Nudges are English; a Hindi voice reads English fine.
    !!topNudge && { text: `Ek baat: ${topNudge}`, hindi: `एक बात: ${topNudge}` },
  );
}

/** Cleans a line for speech: rupee amounts read as words, no emoji or quote marks. */
export function toSpeech(text: string, rupeeWord = "rupaye") {
  return text
    .replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n: string) => `${n.replace(/,/g, "")} ${rupeeWord}`)
    .replace(/&/g, "and")
    .replace(/[“”"]/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
