import type { Category } from "./store";

const CATEGORY_HINTS: [Category, RegExp][] = [
  ["Food", /swiggy|zomato|food|lunch|dinner|breakfast|chai|coffee|restaurant|cafe|biryani|pizza/i],
  ["Groceries", /blinkit|zepto|bigbasket|grocer|vegetable|sabzi|dmart|milk/i],
  ["Transport", /uber|ola|rapido|metro|petrol|fuel|auto|cab|train|irctc|flight/i],
  ["Shopping", /amazon|flipkart|myntra|ajio|shopping|clothes|shoes/i],
  ["Bills", /rent|electricity|bill|recharge|jio|airtel|wifi|broadband|emi/i],
  ["Entertainment", /netflix|hotstar|spotify|movie|pvr|prime|concert/i],
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
  const merchantMatch = text.match(/\b(?:on|at|for|to)\s+([A-Za-z][\w&' ]{1,24}?)(?=\s+(?:last|yesterday|today|this|for|on|at|and|in)\b|[.,!?]|$)/i);
  const merchant = merchantMatch ? capitalize((merchantMatch[1] ?? "").trim()) : "Expense";
  const category = CATEGORY_HINTS.find(([, re]) => re.test(text))?.[0] ?? "Other";
  const daysAgo = /yesterday|last night/i.test(text) ? 1 : 0;
  return { amount, merchant, category, daysAgo };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
