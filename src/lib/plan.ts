import { formatINR } from "./format";
import { merchantKey, yearlyCost, type Recurring } from "./recurring";
import type { Category, Goal, GoalInput, Transaction } from "./store";

const DAY = 86400000;

/** "2027-03" for the month `offset` months after `now`. */
export function monthFrom(now: Date, offset: number) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
  return d.toISOString().slice(0, 7);
}

/** Whole months from this month to `due` ("2027-03"); 0 means it's due this month. */
export function monthsUntil(due: string, now = new Date()) {
  const [y, m] = due.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1) - (now.getFullYear() * 12 + now.getMonth());
}

/** "Mar 2027". */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export interface GoalPlan {
  status: Goal["status"];
  note: string;
  /** What it takes each month to finish on time. */
  needed: number;
  /** Month the goal is reached at the current pace, or null if it never is. */
  finish: string | null;
}

/** Works out where a goal stands from what's saved and what goes into it each month. */
export function planGoal(g: GoalInput, now = new Date()): GoalPlan {
  const remaining = Math.max(0, g.target - g.saved);
  if (remaining === 0) {
    return {
      status: "Reached",
      note: "Goal reached. Nice work.",
      needed: 0,
      finish: monthFrom(now, 0),
    };
  }
  const left = monthsUntil(g.due, now);
  const needed = Math.ceil(remaining / Math.max(1, left));
  const toFinish = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;
  const finish = toFinish === null ? null : monthFrom(now, toFinish);
  const by = formatMonth(g.due);

  if (left <= 0) {
    return {
      status: "At risk",
      note: `The ${by} deadline has passed with ${formatINR(remaining)} to go. Pick a new date to get a fresh plan.`,
      needed: remaining,
      finish,
    };
  }
  if (toFinish === null) {
    return {
      status: "At risk",
      note: `Needs ${formatINR(needed)}/month to finish by ${by}. Add how much you put aside to track it.`,
      needed,
      finish,
    };
  }
  if (toFinish < left) {
    const early = left - toFinish;
    return {
      status: "Ahead",
      note: `On pace to finish in ${formatMonth(finish!)}, ${early} month${early > 1 ? "s" : ""} early.`,
      needed,
      finish,
    };
  }
  if (toFinish === left) {
    return {
      status: "On track",
      note: `${formatINR(g.monthly)}/month gets you there by ${by}.`,
      needed,
      finish,
    };
  }
  return {
    status: "At risk",
    note: `Needs ${formatINR(needed)}/month. You're putting aside ${formatINR(g.monthly)}.`,
    needed,
    finish,
  };
}

/** A month of spending, split into what can be trimmed and what repeats on autopay. */
export interface Baseline {
  income: number;
  /** Everyday spending by category over the last 30 days, recurring payments left out. */
  everyday: Partial<Record<Category, number>>;
  recurring: { key: string; name: string; kind: Recurring["kind"]; monthly: number }[];
}

export function buildBaseline(
  income: number,
  transactions: Transaction[],
  subscriptions: Recurring[],
  now = new Date(),
): Baseline {
  const recurringKeys = new Set(subscriptions.map((s) => s.key));
  const since = now.getTime() - 30 * DAY;
  const everyday: Partial<Record<Category, number>> = {};
  for (const t of transactions) {
    if (new Date(t.date).getTime() < since || recurringKeys.has(merchantKey(t.merchant))) continue;
    everyday[t.category] = (everyday[t.category] ?? 0) + t.amount;
  }
  return {
    income,
    everyday,
    recurring: subscriptions.map((s) => ({
      key: s.key,
      name: s.name,
      kind: s.kind,
      monthly: Math.round(yearlyCost(s) / 12),
    })),
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
  /** A one-off purchase, taken out of the chosen goal's savings. */
  purchase: number;
  /** The goal that gets the difference. */
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
  goal: Goal;
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
const monthIndex = (m: string) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return y * 12 + mo;
};

/** Plays a scenario against a baseline month and the user's goals. */
export function simulate(base: Baseline, s: Scenario, goals: Goal[], now = new Date()): Outcome {
  const everyday = Object.entries(base.everyday) as [Category, number][];
  const recurring = sum(base.recurring.map((r) => r.monthly));
  const spendBefore = sum(everyday.map(([, v]) => v)) + recurring;
  const spendAfter =
    sum(everyday.map(([c, v]) => v * (1 - (s.cuts[c] ?? 0) / 100))) +
    sum(base.recurring.filter((r) => !s.cancel.includes(r.key)).map((r) => r.monthly)) +
    s.emi;
  const incomeAfter = base.income + s.incomeChange;
  const leftBefore = base.income - spendBefore;
  const leftAfter = incomeAfter - spendAfter;
  const difference = Math.round(leftAfter - leftBefore);

  const target = goals.find((g) => g.id === s.goalId) ?? null;
  return {
    spendBefore: Math.round(spendBefore),
    spendAfter: Math.round(spendAfter),
    incomeAfter,
    leftBefore: Math.round(leftBefore),
    leftAfter: Math.round(leftAfter),
    difference,
    goals: goals.map((g) => {
      const changed =
        g === target
          ? {
              ...g,
              monthly: Math.max(0, g.monthly + difference),
              saved: Math.max(0, g.saved - s.purchase),
            }
          : g;
      const before = planGoal(g, now).finish;
      const after = planGoal(changed, now).finish;
      return {
        goal: g,
        before,
        after,
        shift: before && after ? monthIndex(before) - monthIndex(after) : null,
      };
    }),
  };
}
