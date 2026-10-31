import type { Category } from "../store";
import { merchantKey } from "../recurring";

export type Confidence = "high" | "medium" | "low";

/** Merchant → category the user picked by hand. Always wins. */
export type Rules = Record<string, Category>;

/** Common Indian merchants and UPI handles, matched against the cleaned-up name. */
const KNOWN: [Category, RegExp][] = [
  // Before Food, so "Swiggy Instamart" isn't read as a Swiggy order.
  [
    "Groceries",
    /blinkit|grofers|zepto|bigbasket|instamart|dmart|avenue supermart|reliance (fresh|smart|retail)|more retail|spencer|nature'?s basket|jiomart|milkbasket|country delight|kirana|supermarket|provision/i,
  ],
  [
    "Food",
    /swiggy|zomato|eatsure|dominos|pizza ?hut|mcdonald|kfc|burger king|subway|starbucks|third wave|blue tokai|chaayos|haldiram|barbeque|faasos|box8|behrouz|cafe|restaurant|hotel|dhaba|bakery|biryani/i,
  ],
  [
    "Transport",
    /uber|ola|rapido|namma yatri|blusmart|irctc|redbus|indigo|interglobe|air ?india|vistara|akasa|spicejet|makemytrip|goibibo|ixigo|metro|fastag|indian ?oil|iocl|hpcl|bpcl|bharat petroleum|hindustan petroleum|shell|petrol|fuel/i,
  ],
  [
    "Shopping",
    /amazon|flipkart|myntra|ajio|nykaa|meesho|tata ?cliq|croma|reliance digital|vijay sales|decathlon|ikea|lifestyle|westside|zara|h&m|uniqlo|lenskart|firstcry|pepperfry|urban ?ladder/i,
  ],
  [
    "Bills",
    /airtel|jio|vodafone|\bvi\b|bsnl|act fibernet|hathway|tata ?play|bescom|msedcl|tneb|adani (electricity|gas)|tata power|bses|mahanagar gas|indane|hp gas|bharat gas|electricity|water bill|gas bill|broadband|recharge|postpaid|\brent\b|maintenance|society|\bemi\b|loan|insurance|lic\b|policybazaar|bbps|credit card bill|cred\b/i,
  ],
  [
    "Entertainment",
    /netflix|hotstar|disney|spotify|prime video|youtube|apple\.com|google play|sonyliv|zee5|jiocinema|bookmyshow|pvr|inox|cinepolis|steam|playstation|xbox|gaana|wynk|audible/i,
  ],
];

/** Payment-rail noise to strip before reading the merchant name. */
const NOISE = [
  /^(upi|imps|neft|rtgs|ach|nach|pos|ecom|bil|bbps|atw|nwd|vps|ips|mmt|inb|int|si)[\s/\-:]+/i,
  /\b(upi|imps|neft|ref(erence)?|txn|no\.?|ac|a\/c|card|\d*x{2,}\d*|\d{6,})\b/gi,
  /\b[\w.-]+@[a-z]+\b/gi, // VPA like swiggy@icici
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, // IFSC
  /\.(com|co|in)\b/gi,
  /\b(si|e?-?mandate|autopay|standing instruction)\b/gi,
  /\b(paid via|payment to|payment from|to|from|by|towards)\b/gi,
  /\b(pvt|private|ltd|limited|llp|india|technologies|tech|services|retail|internet|online|com)\b\.?/gi,
];

/** Turns "UPI-SWIGGY-swiggy@icici-ICIC0DC0099-4298123" into "Swiggy". */
export function cleanMerchant(raw: string): string {
  if (/\b(atm|atw|nwd|cash wdl|cash withdrawal)\b/i.test(raw)) return "ATM cash withdrawal";
  // UPI narrations are dash- or slash-separated; the payee name is usually the first word-ish part.
  const parts = raw
    .split(/[-/|]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const head =
    /^(upi|imps|neft|rtgs|pos|ecom|bil|bbps|ach|nach|mmt|int|inb)( cr| dr| c| d)?$/i.test(
      parts[0] ?? "",
    )
      ? parts.slice(1)
      : parts;
  const candidate =
    head.find(
      (p) => /[a-z]{3,}/i.test(p) && !/@/.test(p) && !/^(upi|p2a|p2m|payment|ref)/i.test(p),
    ) ?? raw;
  let name = candidate;
  for (const re of NOISE) name = name.replace(re, " ");
  name = name
    .replace(/[^\p{L}\p{N}&'. ]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  // Only a VPA like "swiggy@icici": its handle is the best name there is.
  if (!name) name = raw.match(/([a-z][\w.]*)@/i)?.[1]?.replace(/[._]/g, " ") ?? "";
  if (!name) return raw.trim().slice(0, 40);
  return name
    .split(" ")
    .slice(0, 4)
    .map((w) =>
      // Keep short codes like HSR or KFC, but not words like OIL or PAY.
      w.length <= 3 && /^[B-DF-HJ-NP-TV-Z]+$/.test(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/**
 * Picks a category in layers: the user's own rules, then the known-merchant list
 * against the cleaned name, then against the raw bank text.
 */
export function categorize(
  merchant: string,
  raw: string,
  rules: Rules = {},
): { category: Category; confidence: Confidence; remembered?: true } {
  const rule = rules[merchantKey(merchant)];
  if (rule) return { category: rule, confidence: "high", remembered: true };
  const byName = KNOWN.find(([, re]) => re.test(merchant))?.[0];
  if (byName) return { category: byName, confidence: "high" };
  const byRaw = KNOWN.find(([, re]) => re.test(raw))?.[0];
  if (byRaw) return { category: byRaw, confidence: "medium" };
  return { category: "Other", confidence: "low" };
}
