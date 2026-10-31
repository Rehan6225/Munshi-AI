import { CATEGORY_INFO, isFlexible, isLifestyle, isSaving, type Category } from "./categories";
import { formatINR } from "./format";
import type { GoalPlan } from "./plan";
import { yearlyCost, type Recurring } from "./recurring";
import type { Transaction } from "./store";

/** "2026-10" for any date in October 2026 (local time). */
export function monthKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, by: number) {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return monthKey(new Date(y, m - 1 + by, 1));
}

export function monthLabel(key: string, style: "long" | "short" = "long") {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: style,
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

export interface MonthTotals {
  /** Spending, not counting savings and investments. */
  spent: number;
  invested: number;
  byCategory: Map<Category, number>;
}

/** Spending per calendar month. */
export function totalsByMonth(transactions: Transaction[]) {
  const months = new Map<string, MonthTotals>();
  for (const t of transactions) {
    const key = monthKey(t.date);
    const m = months.get(key) ?? { spent: 0, invested: 0, byCategory: new Map() };
    if (isSaving(t.category)) m.invested += t.amount;
    else {
      m.spent += t.amount;
      m.byCategory.set(t.category, (m.byCategory.get(t.category) ?? 0) + t.amount);
    }
    months.set(key, m);
  }
  return months;
}

const EMPTY: MonthTotals = { spent: 0, invested: 0, byCategory: new Map() };

/**
 * What a category usually costs: the average of the last 3 months before `month`
 * that have any spending at all.
 */
export function usualSpend(
  months: Map<string, MonthTotals>,
  month: string,
  category: Category,
  lookback = 3,
) {
  const earlier = [...months.keys()]
    .filter((k) => k < month && (months.get(k)?.spent ?? 0) > 0)
    .sort();
  const recent = earlier.slice(-lookback);
  if (!recent.length) return 0;
  return (
    recent.reduce((s, k) => s + (months.get(k)!.byCategory.get(category) ?? 0), 0) / recent.length
  );
}

export interface CategoryRow {
  category: Category;
  amount: number;
  previous: number;
  /** Percent change vs last month; null when there was nothing last month. */
  change: number | null;
}

export interface MonthlyReview {
  month: string;
  label: string;
  income: number;
  spent: number;
  invested: number;
  saved: number;
  savingsRate: number | null;
  previousSpent: number;
  change: number | null;
  categories: CategoryRow[];
  trend: { month: string; label: string; spent: number }[];
  wins: string[];
  suggestions: string[];
}

const pct = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

export function buildReview({
  transactions,
  month,
  income,
  subscriptions,
  goals,
}: {
  transactions: Transaction[];
  month: string;
  income: number;
  subscriptions: Recurring[];
  goals: GoalPlan[];
}): MonthlyReview {
  const months = totalsByMonth(transactions);
  const now = months.get(month) ?? EMPTY;
  const before = months.get(shiftMonth(month, -1)) ?? EMPTY;
  const saved = income - now.spent;

  const names = new Set([...now.byCategory.keys(), ...before.byCategory.keys()]);
  const categories = [...names]
    .map((category) => {
      const amount = now.byCategory.get(category) ?? 0;
      const previous = before.byCategory.get(category) ?? 0;
      return { category, amount, previous, change: pct(amount, previous) };
    })
    .sort((a, b) => b.amount - a.amount);

  const trend = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5);
    return { month: key, label: monthLabel(key, "short"), spent: months.get(key)?.spent ?? 0 };
  });

  const rate = income > 0 ? Math.max(0, Math.round((saved / income) * 100)) : null;
  const wins: string[] = [];
  const suggestions: string[] = [];

  // Wins: things that went right this month.
  const down = categories
    .filter((c) => isFlexible(c.category) && c.previous > 0 && c.amount < c.previous)
    .sort((a, b) => b.previous - b.amount - (a.previous - a.amount));
  for (const c of down.slice(0, 2))
    wins.push(
      `${CATEGORY_INFO[c.category].emoji} ${c.category} down ${formatINR(c.previous - c.amount)} from last month.`,
    );
  if (rate !== null && rate >= 30) wins.push(`Saved ${rate}% of your income. That's healthy.`);
  if (now.invested > 0) wins.push(`Invested ${formatINR(now.invested)} for the future.`);
  for (const g of goals.filter((g) => g.status === "Ahead" || g.status === "Done").slice(0, 1))
    wins.push(`${g.name} is ${g.status === "Done" ? "fully funded" : "ahead of plan"}.`);

  // Suggestions: where the next rupee of savings is.
  const up = categories
    .filter((c) => isLifestyle(c.category) && c.amount > c.previous && c.amount - c.previous >= 500)
    .sort((a, b) => b.amount - b.previous - (a.amount - a.previous));
  for (const c of up.slice(0, 2))
    suggestions.push(
      `${CATEGORY_INFO[c.category].emoji} ${c.category} rose ${formatINR(c.amount - c.previous)}${c.change !== null ? ` (+${c.change}%)` : ""}. Cutting it by 30% saves ${formatINR(c.amount * 0.3)} a month.`,
    );
  const unused = subscriptions.filter((s) => s.alerts.includes("unused"));
  if (unused.length)
    suggestions.push(
      `Cancel ${unused.map((s) => s.name).join(" and ")} to save ${formatINR(unused.reduce((t, s) => t + yearlyCost(s), 0))} a year.`,
    );
  for (const s of subscriptions.filter((s) => s.alerts.includes("price-up")).slice(0, 1))
    if (s.previousAmount)
      suggestions.push(
        `${s.name} went up from ${formatINR(s.previousAmount)} to ${formatINR(s.amount)}. Is a cheaper plan enough?`,
      );
  for (const g of goals.filter((g) => g.status === "At risk").slice(0, 1))
    suggestions.push(`${g.name} is at risk: it needs ${formatINR(g.neededPerMonth)} a month.`);

  return {
    month,
    label: monthLabel(month),
    income,
    spent: now.spent,
    invested: now.invested,
    saved,
    savingsRate: rate,
    previousSpent: before.spent,
    change: pct(now.spent, before.spent),
    categories,
    trend,
    wins: wins.slice(0, 3),
    suggestions: suggestions.slice(0, 3),
  };
}

/** Months that have any transactions, newest first. */
export function monthsWithData(transactions: Transaction[]) {
  return [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse();
}
