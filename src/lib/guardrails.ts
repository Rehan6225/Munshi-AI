/**
 * Munshi educates and models scenarios but never recommends specific securities.
 * Checked twice: on the question (before any AI runs) and on the AI's answer.
 */

/** Well-known Indian stocks, fund houses and crypto people ask about by name. */
const NAMED_SECURITIES =
  /\b(reliance|tcs|infosys|infy|hdfc bank|icici bank|sbi (?:share|stock)|adani\w*|tata (?:motors|steel|power)|wipro|itc|bajaj finance|paytm (?:share|stock)|zomato (?:share|stock)|nifty ?bees|parag parikh|mirae|nippon|quant (?:small|mid|active)|axis bluechip|sbi (?:small|blue|magnum)|motilal|nasdaq 100|bitcoin|btc|ethereum|eth|dogecoin|doge|solana|xrp|shiba|bnb)\b/i;

const CRYPTO =
  /\b(crypto\w*|bitcoin|btc|ethereum|eth|dogecoin|doge|solana|xrp|shiba|altcoins?|nfts?)\b/i;

/** "which stock should I buy", "best mutual fund", "suggest some shares", "stock tips". */
const ASKS_FOR_A_PICK =
  /\b(which|best|top|recommend\w*|suggest\w*|tips?|pick|name (?:a|some|any)|kaun ?sa|konsa)\b.{0,40}\b(stocks?|shares?|mutual funds?|funds?|etfs?|ipos?|smallcases?|crypto\w*|coins?|penny)\b|\b(stocks?|shares?|funds?|crypto)\b.{0,20}\b(tips?|recommend\w*|suggest\w*|to buy)\b|\bmultibagger/i;

const BUY_SELL = /\b(buy|invest(?:ing)? in|put (?:my )?money in|sell|hold|lagau|kharid\w*)\b/i;

/** True when the question asks Munshi to pick or rate a specific investment. */
export function asksForSecurities(question: string) {
  if (ASKS_FOR_A_PICK.test(question)) return true;
  return BUY_SELL.test(question) && (CRYPTO.test(question) || NAMED_SECURITIES.test(question));
}

/** True when an answer names a specific investment, so it must not be shown. */
export function namesSecurities(answer: string) {
  return NAMED_SECURITIES.test(answer) || /\b[A-Z]{3,12}(?:\.NS|\.BO)\b/.test(answer);
}

export interface GuardrailContext {
  emergencyPct?: number | undefined;
  invested?: number | undefined;
}

/** A warm "no", plus what Munshi can do instead. */
export function guardrailAnswer({ emergencyPct, invested }: GuardrailContext = {}) {
  const tips = [
    emergencyPct !== undefined && emergencyPct < 100
      ? `Emergency fund first: you're at ${emergencyPct}% of yours. Money for investing should be money you won't need in a hurry.`
      : "Emergency fund first: keep 6 months of expenses somewhere safe before taking market risk.",
    "Index funds vs single stocks: an index fund spreads your money across the whole market at a low cost, while picking individual stocks or coins is much riskier.",
    invested
      ? `You already put ₹${Math.round(invested).toLocaleString("en-IN")} a month into investments. I can show how changing that affects your goals.`
      : "A small monthly SIP builds the habit. I can show how much you could set aside each month.",
  ];
  return [
    "Maaf kijiye, I can't recommend specific stocks, funds or crypto. That needs a SEBI-registered investment adviser who knows your full situation.",
    "What I can do is explain the basics:",
    ...tips.map((t) => `• ${t}`),
  ].join("\n");
}
