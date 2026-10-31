import { isSaving, type Category } from "./categories";
import { formatINR } from "./format";
import { yearlyCost, type Recurring } from "./recurring";
import type { Transaction } from "./store";

const DAY = 86400000;

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
}

export interface Profile {
  /** Monthly take-home pay. */
  income: number;
  /** Emergency fund size, in months of spending. */
  emergencyMonths: number;
  /** Fixed costs Munshi can't see in transactions, e.g. an EMI paid from another account. */
  extraFixedCosts: FixedCost[];
  /** Optional monthly limits; nudges compare against these, else against the usual spend. */
  budgets: Partial<Record<Category, number>>;
}

export interface Goal {
  id: string;
  name: string;
  /** Ignored for the emergency fund, whose target comes from spending. */
  target: number;
  saved: number;
  /** ISO date the goal should be reached by. */
  due: string;
  emergency?: boolean | undefined;
}

export type GoalStatus = "Ahead" | "On track" | "At risk" | "Done";

export interface GoalPlan extends Goal {
  monthsLeft: number;
  neededPerMonth: number;
  /** Equal share of monthly savings available to this goal. */
  sharePerMonth: number;
  pct: number;
  status: GoalStatus;
  note: string;
}

const lastMonth = (transactions: Transaction[], now: number) =>
  transactions.filter((t) => now - new Date(t.date).getTime() < 30 * DAY);

/** Total spent in the last 30 days. Savings and investments aren't spending. */
export function monthlySpend(transactions: Transaction[], now = Date.now()) {
  return lastMonth(transactions, now)
    .filter((t) => !isSaving(t.category))
    .reduce((s, t) => s + t.amount, 0);
}

/** Put into SIPs, RDs and other investments in the last 30 days. */
export function monthlyInvested(transactions: Transaction[], now = Date.now()) {
  return lastMonth(transactions, now)
    .filter((t) => isSaving(t.category))
    .reduce((s, t) => s + t.amount, 0);
}

/** Bills detected in transactions plus anything the user added by hand, per month. */
export function fixedCosts(subscriptions: Recurring[], profile: Profile) {
  const detected = subscriptions
    .filter((s) => s.kind === "bill")
    .map((s) => ({ id: s.key, name: s.name, amount: yearlyCost(s) / 12, detected: true }));
  const items = [...detected, ...profile.extraFixedCosts.map((c) => ({ ...c, detected: false }))];
  return { items, total: items.reduce((s, c) => s + c.amount, 0) };
}

export function monthsUntil(iso: string, now = Date.now()) {
  return (new Date(iso).getTime() - now) / (30.44 * DAY);
}

/**
 * Splits what's left after spending equally across unfinished goals, then checks
 * whether each goal's share covers what it needs per month to land on time.
 */
export function planGoals(
  goals: Goal[],
  {
    income,
    spend,
    fixed,
    emergencyMonths,
    invested = 0,
  }: { income: number; spend: number; fixed: number; emergencyMonths: number; invested?: number },
  now = Date.now(),
): GoalPlan[] {
  const monthlyNeed = Math.max(spend, fixed);
  const withTargets = goals.map((g) =>
    g.emergency ? { ...g, target: Math.round(emergencyMonths * monthlyNeed) } : g,
  );
  const open = withTargets.filter((g) => g.saved < g.target).length;
  // Money already going into SIPs isn't free for these goals.
  const share = open ? Math.max(0, income - spend - invested) / open : 0;

  return withTargets.map((g) => {
    const remaining = Math.max(0, g.target - g.saved);
    const monthsLeft = monthsUntil(g.due, now);
    const neededPerMonth = remaining / Math.max(1, monthsLeft);
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    const by = new Date(g.due).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

    let status: GoalStatus;
    let note: string;
    if (g.target <= 0) {
      status = "On track";
      note = "Log a few expenses so Munshi can size this.";
    } else if (remaining === 0) {
      status = "Done";
      note = "Fully funded. Nice work! 🎉";
    } else if (monthsLeft <= 0) {
      status = "At risk";
      note = `The ${by} deadline has passed with ${formatINR(remaining)} to go. Pick a new date?`;
    } else if (neededPerMonth > share) {
      status = "At risk";
      note = `Needs ${formatINR(neededPerMonth)}/month to hit ${by}. You can put about ${formatINR(share)} toward it.`;
    } else if (neededPerMonth <= share * 0.6) {
      status = "Ahead";
      note = `Only ${formatINR(neededPerMonth)}/month needed for ${by}, so you have room to spare.`;
    } else {
      status = "On track";
      note = `${formatINR(neededPerMonth)}/month gets you there by ${by}.`;
    }

    return { ...g, monthsLeft, neededPerMonth, sharePerMonth: share, pct, status, note };
  });
}

/** ISO date `months` from now, on the 1st. */
export function monthsFromNow(months: number, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + months, 1).toISOString();
}
