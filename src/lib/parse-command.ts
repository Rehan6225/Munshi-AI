import type { Category } from "./store";

/** Checked in order, so specific matches (subscriptions, travel) win over broad ones. */
const CATEGORY_HINTS: [Category, RegExp][] = [
  [
    "Savings & Investments",
    /\b(sip|mutual funds?|\brd\b|ppf|nps|invest\w*|groww|zerodha|stocks?)\b/i,
  ],
  [
    "Subscriptions",
    /netflix|hotstar|spotify|youtube premium|prime video|amazon prime|cult|gym|subscription|jiocinema|sonyliv|zee5/i,
  ],
  ["Rent & Housing", /\b(rent|maintenance|society|landlord)\b/i],
  ["EMIs & Loans", /\b(emi|loan|credit card bill)\b/i],
  ["Insurance", /insurance|\bpremium\b|\blic\b|policy/i],
  [
    "Utilities",
    /electricity|bescom|power bill|water bill|\bgas\b|lpg|cylinder|recharge|jio|airtel|\bvi\b|wifi|broadband|dth|tata play/i,
  ],
  [
    "Household help",
    /\b(maid|cook|bai|driver|laundry|dhobi|ironing|press|househelp|house help)\b/i,
  ],
  ["Education", /\b(fees?|tuition|coaching|course|school|college|udemy|coursera|books?)\b/i],
  [
    "Family support",
    /\b(sent|send|gave|transfer\w*)\b.*\b(mom|mum|maa|dad|papa|parents|home|family|sister|brother)\b/i,
  ],
  [
    "Health",
    /medicine|pharmacy|apollo|medplus|1mg|pharmeasy|doctor|hospital|clinic|\blab\b|dentist/i,
  ],
  ["Personal care", /salon|haircut|hair cut|spa|grooming|parlou?r|barber/i],
  ["Travel", /flight|hotel|\btrip\b|makemytrip|goibibo|irctc|\btrain\b|oyo|airbnb|holiday/i],
  ["Transport", /uber|ola|rapido|metro|petrol|diesel|fuel|\bauto\b|cab|\bbus\b|parking|toll/i],
  [
    "Groceries",
    /blinkit|zepto|bigbasket|instamart|grocer|vegetable|sabzi|dmart|kirana|\bmilk\b|fruits?/i,
  ],
  [
    "Food & Dining",
    /swiggy|zomato|food|lunch|dinner|breakfast|chai|coffee|restaurant|cafe|biryani|pizza|snacks?/i,
  ],
  ["Shopping", /amazon|flipkart|myntra|ajio|meesho|nykaa|shopping|clothes|shoes|gadget/i],
  ["Entertainment", /movie|pvr|inox|bookmyshow|concert|event|game|outing|club/i],
];

/** Pulls amount, merchant and category out of long, messy dictated sentences. */
export function parseCommand(text: string) {
  const cleaned = text.replace(/,(?=\d{2,3}\b)/g, "");
  let amount: number | null = null;
  const m = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh|lakhs|l)?\b/i);
  if (m) {
    amount = parseFloat(m[1] ?? "0");
    const unit = m[2]?.toLowerCase();
    if (unit === "k" || unit === "thousand") amount *= 1000;
    if (unit === "lakh" || unit === "lakhs" || unit === "l") amount *= 100000;
  }
  const merchantMatch = text.match(
    /\b(?:on|at|for|to)\s+([A-Za-z][\w&' ]{1,24}?)(?=\s+(?:last|yesterday|today|this|for|on|at|and|in)\b|[.,!?]|$)/i,
  );
  // "paid 200 auto", "150 chai with friends": no preposition, so take the word after the amount.
  const afterAmount = cleaned.match(
    /\d+(?:\.\d+)?\s*(?:k\b|rs\.?|rupees|₹)?\s+(?!(?:on|at|for|to|yesterday|today|last|this|and|rupees)\b)([a-z][\w&']{1,20})/i,
  );
  const merchant = merchantMatch
    ? capitalize((merchantMatch[1] ?? "").trim())
    : afterAmount
      ? capitalize(afterAmount[1]!)
      : "Expense";
  const category = CATEGORY_HINTS.find(([, re]) => re.test(text))?.[0] ?? "Other";
  const daysAgo = /day before yesterday/i.test(text)
    ? 2
    : /yesterday|last night/i.test(text)
      ? 1
      : 0;
  return { amount, merchant, category, daysAgo };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
