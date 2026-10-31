import { merchantKey } from "./recurring";
import type { Category, Transaction } from "./store";

export interface Rule {
  id: string;
  /** Normalised merchant this rule matches, see merchantKey(). */
  key: string;
  merchant: string;
  category: Category;
  /** How many transactions this rule has categorised. */
  applied: number;
  createdAt: string;
}

export function findRule(merchant: string, rules: Rule[]) {
  const key = merchantKey(merchant);
  return rules.find((r) => r.key === key);
}

/**
 * Suggests a category when a transaction disagrees with how the same merchant is
 * usually filed, e.g. one Swiggy order under Groceries when the rest are Food.
 * Needs at least two other transactions to agree, so one-offs never get flagged.
 */
export function suggestCategories(transactions: Transaction[]) {
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = merchantKey(t.merchant);
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), t]);
  }

  const suggestions = new Map<string, Category>();
  for (const txs of byMerchant.values()) {
    if (txs.length < 3) continue;
    for (const t of txs) {
      if (t.ruleId) continue;
      const counts = new Map<Category, number>();
      for (const o of txs) if (o !== t) counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
      const [usual, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
      if (usual !== t.category && n >= 2 && n / (txs.length - 1) >= 2 / 3)
        suggestions.set(t.id, usual);
    }
  }
  return suggestions;
}

/** How people say each category out loud. */
const CATEGORY_WORDS: [Category, RegExp][] = [
  ["Food & Dining", /\b(food|eating out|dining|restaurants?|takeaway|food delivery)\b/g],
  ["Groceries", /\b(groceries|grocery|kirana)\b/g],
  ["Transport", /\b(transport|commute|cabs?|fuel)\b/g],
  ["Travel", /\b(travel|trips?|holidays?)\b/g],
  ["Shopping", /\b(shopping)\b/g],
  ["Rent & Housing", /\b(rent|housing|home)\b/g],
  ["Utilities", /\b(utilities|utility|bills?)\b/g],
  ["EMIs & Loans", /\b(emis?|loans?)\b/g],
  ["Insurance", /\b(insurance)\b/g],
  ["Household help", /\b(household help|house help|household|help|laundry)\b/g],
  ["Education", /\b(education|studies|fees)\b/g],
  ["Family support", /\b(family support|family)\b/g],
  ["Subscriptions", /\b(subscriptions?)\b/g],
  ["Health", /\b(health|medical|medicines?)\b/g],
  ["Entertainment", /\b(entertainment|fun|movies?)\b/g],
  ["Personal care", /\b(personal care|grooming|self care)\b/g],
  ["Savings & Investments", /\b(savings?|investments?|investing|sip)\b/g],
  ["Other", /\b(other|misc|miscellaneous)\b/g],
];

const RULE_INTENT =
  /\b(remember|always|from now on|is|are|should be|categori[sz]e|file|put|move|count|treat|mark)\b/;

export type RuleCommand = { merchant: string; category: Category };

/**
 * Understands corrections like "Swiggy is food, not groceries, remember that" or
 * "always put Uber under transport". Only merchants the user already has count.
 */
export function parseRuleCommand(text: string, merchants: string[]): RuleCommand | null {
  const lower = text.toLowerCase();
  if (!RULE_INTENT.test(lower)) return null;

  const merchant = [...new Set(merchants)]
    .sort((a, b) => b.length - a.length)
    .find((m) => {
      const name = m.toLowerCase();
      return (
        lower.includes(name) ||
        name.split(/[^a-z0-9]+/).some((w) => w.length >= 4 && lower.includes(w))
      );
    });
  if (!merchant) return null;

  // Where the merchant's name was said: words in there ("Star Health insurance") aren't categories.
  const name = merchant.toLowerCase();
  const start = lower.indexOf(name);
  const span = start >= 0 ? { from: start, to: start + name.length } : { from: -1, to: -1 };

  // First category mentioned that isn't negated ("not groceries", "instead of groceries").
  const mentions: { category: Category; at: number }[] = [];
  for (const [category, re] of CATEGORY_WORDS) {
    for (const m of lower.matchAll(re)) {
      if (m.index >= span.from && m.index < span.to) continue;
      const before = lower.slice(Math.max(0, m.index - 14), m.index);
      if (!/\b(not|isn'?t|instead of|rather than|from)\s+(an?\s+|the\s+)?$/.test(before))
        mentions.push({ category, at: m.index });
    }
  }
  const pick = mentions.sort((a, b) => a.at - b.at)[0];
  return pick ? { merchant, category: pick.category } : null;
}
