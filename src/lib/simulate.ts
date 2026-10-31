import { isSaving, type Category } from "./categories";
import { merchantKey, yearlyCost, type Recurring } from "./recurring";
import { planGoals, type Goal, type GoalPlan, type Profile } from "./plan";
import type { Transaction } from "./store";

const DAY = 86400000;

/** A month of money, split into what can be trimmed and what repeats on autopay. */
export interface Baseline {
  income: number;
  /** Everyday spending by category over the last 30 days, recurring payments left out. */
  everyday: Partial<Record<Category, number>>;
  recurring: { key: string; name: string; kind: Recurring["kind"]; monthly: number }[];
  /** Put into SIPs and other savings in the last 30 days; not spending. */
  invested: number;
  /** Fixed costs the user added by hand in their profile. */
  extraFixed: number;
  emergencyMonths: number;
}

export function buildBaseline(
  profile: Profile,
  transactions: Transaction[],
  subscriptions: Recurring[],
  now = new Date(),
): Baseline {
  const recurringKeys = new Set(subscriptions.map((s) => s.key));
  const since = now.getTime() - 30 * DAY;
  const everyday: Partial<Record<Category, number>> = {};
  let invested = 0;
  for (const t of transactions) {
    if (new Date(t.date).getTime() < since) continue;
    if (isSaving(t.category)) invested += t.amount;
    else if (!recurringKeys.has(merchantKey(t.merchant))) {
      everyday[t.category] = (everyday[t.category] ?? 0) + t.amount;
    }
  }
  return {
    income: profile.income,
    everyday,
    recurring: subscriptions.map((s) => ({
      key: s.key,
      name: s.name,
      kind: s.kind,
      monthly: Math.round(yearlyCost(s) / 12),
    })),
    invested,
    extraFixed: profile.extraFixedCosts.reduce((s, c) => s + c.amount, 0),
    emergencyMonths: profile.emergencyMonths,
  };
}

export interface Scenario {
  /** Change to monthly income, in ₹ (negative for a pay cut). */
  incomeChange: number;
  /** Percent to cut from each category's everyday spending. */
  cuts: Partial<Record<Category, number>>;
  /** Recurring payments to stop. */
  cancel: string[];
  /** A new monthly EMI. */
  emi: number;
  /** A one-off purchase, paid from the chosen goal's savings. */
  purchase: number;
  /** The goal a purchase is paid from. */
  goalId: string | null;
}

export const EMPTY_SCENARIO: Scenario = {
  incomeChange: 0,
  cuts: {},
  cancel: [],
  emi: 0,
  purchase: 0,
  goalId: null,
};

export interface GoalImpact {
  goal: GoalPlan;
  /** Month the goal is reached ("2027-03"), or null if it never is at this pace. */
  before: string | null;
  after: string | null;
  /** Months sooner (positive) or later (negative); null when either side never finishes. */
  shift: number | null;
}

export interface Outcome {
  spendBefore: number;
  spendAfter: number;
  incomeAfter: number;
  leftBefore: number;
  leftAfter: number;
  /** Extra (or less) money left each month. */
  difference: number;
  goals: GoalImpact[];
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** When a planned goal is reached at its share of each month's savings. */
function finish(g: GoalPlan, now: Date) {
  if (g.status === "Done") return monthKey(now);
  const remaining = Math.max(0, g.target - g.saved);
  if (g.sharePerMonth <= 0 || remaining <= 0) return null;
  const months = Math.ceil(remaining / g.sharePerMonth);
  return monthKey(new Date(now.getFullYear(), now.getMonth() + months, 1));
}

const monthIndex = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return y * 12 + mo;
};

/** Plays a scenario against a baseline month and the user's goals. */
export function simulate(base: Baseline, s: Scenario, goals: Goal[], now = new Date()): Outcome {
  const everyday = Object.entries(base.everyday) as [Category, number][];
  const kept = base.recurring.filter((r) => !s.cancel.includes(r.key));
  const spendBefore = sum(everyday.map(([, v]) => v)) + sum(base.recurring.map((r) => r.monthly));
  const spendAfter =
    sum(everyday.map(([c, v]) => v * (1 - (s.cuts[c] ?? 0) / 100))) +
    sum(kept.map((r) => r.monthly)) +
    s.emi;
  const bills = (list: typeof base.recurring) =>
    sum(list.filter((r) => r.kind === "bill").map((r) => r.monthly)) + base.extraFixed;
  const incomeAfter = base.income + s.incomeChange;

  const plan = (income: number, spend: number, fixed: number, list: Goal[]) =>
    planGoals(
      list,
      { income, spend, fixed, invested: base.invested, emergencyMonths: base.emergencyMonths },
      now.getTime(),
    );
  const before = plan(base.income, spendBefore, bills(base.recurring), goals);
  const after = plan(
    incomeAfter,
    spendAfter,
    bills(kept) + s.emi,
    goals.map((g) =>
      g.id === s.goalId && s.purchase ? { ...g, saved: Math.max(0, g.saved - s.purchase) } : g,
    ),
  );

  const leftBefore = base.income - spendBefore;
  const leftAfter = incomeAfter - spendAfter;
  return {
    spendBefore: Math.round(spendBefore),
    spendAfter: Math.round(spendAfter),
    incomeAfter,
    leftBefore: Math.round(leftBefore),
    leftAfter: Math.round(leftAfter),
    difference: Math.round(leftAfter - leftBefore),
    goals: before.map((g, i) => {
      const b = finish(g, now);
      const a = finish(after[i]!, now);
      return { goal: g, before: b, after: a, shift: b && a ? monthIndex(b) - monthIndex(a) : null };
    }),
  };
}

/** "Mar 2027" from "2027-03". */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
