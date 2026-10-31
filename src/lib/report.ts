import { formatINR } from "./format";
import { daysSince, yearlyCost, type Recurring } from "./recurring";
import { isSaving } from "./categories";
import type { GoalPlan } from "./plan";
import type { Category, Transaction } from "./store";

const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10", in the user's own timezone. */
export const monthOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const monthLabel = (month: string, style: "long" | "short" = "long") => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: style,
    ...(style === "long" && { year: "numeric" }),
  });
};

/** Months that have any spending, newest first. */
export function monthsWithData(transactions: Transaction[]) {
  return [...new Set(transactions.map((t) => monthOf(t.date)))].sort().reverse();
}

export interface MonthReport {
  month: string;
  label: string;
  /** Null when the user hasn't told us their salary. */
  income: number | null;
  spent: number;
  saved: number | null;
  /** Share of income kept, 0–100; negative when overspent. Null without an income. */
  savingsRate: number | null;
  count: number;
  categories: { category: Category; amount: number; share: number }[];
  previousLabel: string | null;
  changes: { category: Category; now: number; before: number; diff: number }[];
  trend: { month: string; label: string; amount: number }[];
  merchants: { name: string; count: number; amount: number }[];
  subscriptions: {
    name: string;
    kind: Recurring["kind"];
    cycle: Recurring["cycle"];
    amount: number;
    yearly: number;
    note: string;
  }[];
  subscriptionsMonthly: number;
  goals: GoalPlan[];
  highlights: { tone: "good" | "warn" | "info"; text: string }[];
}

interface Input {
  transactions: Transaction[];
  subscriptions: Recurring[];
  goals: GoalPlan[];
  income: number | null;
}

const byCategory = (txs: Transaction[]) => {
  const out = new Map<Category, number>();
  for (const t of txs) out.set(t.category, (out.get(t.category) ?? 0) + t.amount);
  return out;
};

/** Everything the review page and the PDF report show for one month. */
export function buildMonthReport(
  { transactions, subscriptions, goals, income }: Input,
  month: string,
  now = Date.now(),
): MonthReport {
  // Money moved into savings and investments isn't spending.
  const inMonth = (m: string) =>
    transactions.filter((t) => monthOf(t.date) === m && !isSaving(t.category));
  const txs = inMonth(month);
  const spent = txs.reduce((s, t) => s + t.amount, 0);
  const saved = income === null ? null : income - spent;
  const cats = byCategory(txs);
  const prevMonth = shift(month, -1);
  const prevTxs = inMonth(prevMonth);
  const prevCats = byCategory(prevTxs);

  const categories = [...cats.entries()]
    .map(([category, amount]) => ({ category, amount, share: spent ? amount / spent : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const changes = prevTxs.length
    ? [...new Set([...cats.keys(), ...prevCats.keys()])]
        .map((category) => {
          const now = cats.get(category) ?? 0;
          const before = prevCats.get(category) ?? 0;
          return { category, now, before, diff: now - before };
        })
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    : [];

  const merchants = [
    ...txs
      .reduce((m, t) => {
        const r = m.get(t.merchant) ?? { name: t.merchant, count: 0, amount: 0 };
        m.set(t.merchant, { ...r, count: r.count + 1, amount: r.amount + t.amount });
        return m;
      }, new Map<string, { name: string; count: number; amount: number }>())
      .values(),
  ]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const subs = subscriptions.map((s) => {
    const notes: string[] = [];
    if (s.alerts.includes("unused")) {
      notes.push(
        s.lastUsed ? `Not used in ${daysSince(s.lastUsed, now)} days` : "You said you don't use it",
      );
    }
    if (s.alerts.includes("price-up") && s.previousAmount) {
      notes.push(`Price up from ${formatINR(s.previousAmount)}`);
    }
    if (s.alerts.includes("new")) notes.push("New this quarter");
    return {
      name: s.name,
      kind: s.kind,
      cycle: s.cycle,
      amount: s.amount,
      yearly: yearlyCost(s),
      note: notes.join(". "),
    };
  });

  const highlights: MonthReport["highlights"] = [];
  if (spent > 0 && income !== null && saved !== null) {
    highlights.push(
      saved >= 0
        ? {
            tone: "good",
            text: `You kept ${formatINR(saved)}, ${Math.round((saved / income) * 100)}% of your income.`,
          }
        : { tone: "warn", text: `You spent ${formatINR(-saved)} more than you earned.` },
    );
  }
  const top = categories[0];
  if (top) {
    highlights.push({
      tone: "info",
      text: `${top.category} was your biggest spend at ${formatINR(top.amount)} (${Math.round(top.share * 100)}%).`,
    });
  }
  const jump = changes.find((c) => c.diff > 0 && c.before > 0 && c.diff >= 500);
  if (jump) {
    highlights.push({
      tone: "warn",
      text: `${jump.category} is up ${formatINR(jump.diff)} on ${monthLabel(prevMonth, "short")} (+${Math.round((jump.diff / jump.before) * 100)}%).`,
    });
  }
  const drop = changes.find((c) => c.diff < 0 && -c.diff >= 500);
  if (drop) {
    highlights.push({
      tone: "good",
      text: `${drop.category} is down ${formatINR(-drop.diff)} on ${monthLabel(prevMonth, "short")}.`,
    });
  }
  for (const s of subscriptions.filter((s) => s.alerts.includes("unused")).slice(0, 2)) {
    highlights.push({
      tone: "warn",
      text: `${s.name} costs ${formatINR(yearlyCost(s))} a year and isn't being used. Cancelling saves that.`,
    });
  }
  const hike = subscriptions.find((s) => s.alerts.includes("price-up") && s.previousAmount);
  if (hike) {
    highlights.push({
      tone: "warn",
      text: `${hike.name} went up from ${formatINR(hike.previousAmount!)} to ${formatINR(hike.amount)}.`,
    });
  }
  for (const g of goals.filter((g) => g.status === "At risk").slice(0, 2)) {
    highlights.push({ tone: "warn", text: `${g.name} is at risk. ${g.note}` });
  }

  return {
    month,
    label: monthLabel(month),
    income,
    spent,
    saved,
    savingsRate: income && saved !== null ? Math.round((saved / income) * 100) : null,
    count: txs.length,
    categories,
    previousLabel: prevTxs.length ? monthLabel(prevMonth) : null,
    changes,
    trend: [-5, -4, -3, -2, -1, 0].map((i) => {
      const m = shift(month, i);
      return {
        month: m,
        label: monthLabel(m, "short"),
        amount: inMonth(m).reduce((s, t) => s + t.amount, 0),
      };
    }),
    merchants,
    subscriptions: subs,
    subscriptionsMonthly: Math.round(subs.reduce((s, r) => s + r.yearly, 0) / 12),
    goals,
    highlights,
  };
}
