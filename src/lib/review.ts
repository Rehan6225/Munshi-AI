import { isSaving, type Category } from "./categories";
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
