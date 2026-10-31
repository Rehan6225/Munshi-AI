import { CATEGORY_INFO, isFlexible, type Category } from "./categories";
import { formatINR } from "./format";
import type { GoalPlan } from "./plan";
import { daysSince, yearlyCost, type Recurring } from "./recurring";
import { monthKey, totalsByMonth, usualSpend } from "./review";
import type { Transaction } from "./store";

export type NudgeKind = "drift" | "budget" | "subscription" | "category" | "goal";

export interface Nudge {
  kind: NudgeKind;
  text: string;
  to: "/monthly-review" | "/subscriptions" | "/transactions" | "/goals" | "/profile";
}

/** Projected spend must beat the plan by this much before Munshi says anything. */
const DRIFT = 0.15;
/** Below this, a category is too small to nag about. */
const MIN_SPEND = 500;

/**
 * Spending drift for each flexible category this month. The plan is the budget the
 * user set, or else what the category usually costs (average of the last 3 months).
 */
export function driftNudges(
  transactions: Transaction[],
  budgets: Partial<Record<Category, number>>,
  now = new Date(),
): Nudge[] {
  const months = totalsByMonth(transactions);
  const month = monthKey(now);
  const thisMonth = months.get(month)?.byCategory ?? new Map<Category, number>();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ordinal = `${day}${["th", "st", "nd", "rd"][day % 10 > 3 || Math.floor(day / 10) === 1 ? 0 : day % 10]}`;

  const out: { nudge: Nudge; severity: number }[] = [];
  const categories = new Set<Category>([
    ...thisMonth.keys(),
    ...(Object.keys(budgets) as Category[]),
  ]);
  for (const c of categories) {
    if (!isFlexible(c)) continue;
    const spent = thisMonth.get(c) ?? 0;
    const name = `${CATEGORY_INFO[c].emoji} ${c}`;
    const budget = budgets[c];

    if (budget && budget > 0) {
      const used = spent / budget;
      if (used >= 1)
        out.push({
          severity: used + 1,
          nudge: {
            kind: "budget",
            to: "/profile",
            text: `You've gone past your ${formatINR(budget)} ${name} budget: ${formatINR(spent)} so far.`,
          },
        });
      else if (used >= 0.8 && day < daysInMonth - 3)
        out.push({
          severity: used,
          nudge: {
            kind: "budget",
            to: "/profile",
            text: `You've used ${Math.round(used * 100)}% of your ${formatINR(budget)} ${name} budget and it's only the ${ordinal}.`,
          },
        });
      continue;
    }

    // No budget: compare with the usual, projecting the month once a week has passed.
    const usual = usualSpend(months, month, c);
    if (usual < MIN_SPEND || spent < MIN_SPEND) continue;
    const projected = day >= 7 ? (spent / day) * daysInMonth : spent;
    if (projected > usual * (1 + DRIFT)) {
      const finished = day >= daysInMonth - 1;
      out.push({
        severity: projected / usual,
        nudge: {
          kind: "drift",
          to: "/monthly-review",
          text: finished
            ? `${name} is ${formatINR(spent)} this month, ${formatINR(spent - usual)} over your usual ${formatINR(usual)}.`
            : `${name} is heading for ${formatINR(projected)} this month, ${formatINR(projected - usual)} over your usual ${formatINR(usual)}.`,
        },
      });
    }
  }
  return out.sort((a, b) => b.severity - a.severity).map((o) => o.nudge);
}

/** Everything worth a heads-up on the dashboard, most important first. */
export function buildNudges({
  transactions,
  subscriptions,
  suggestions,
  goals,
  budgets,
  now = new Date(),
}: {
  transactions: Transaction[];
  subscriptions: Recurring[];
  suggestions: Map<string, Category>;
  goals: GoalPlan[];
  budgets: Partial<Record<Category, number>>;
  now?: Date;
}): Nudge[] {
  const nudges: Nudge[] = driftNudges(transactions, budgets, now).slice(0, 2);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const unused = subscriptions.find((s) => s.alerts.includes("unused"));
  if (unused)
    nudges.push({
      kind: "subscription",
      to: "/subscriptions",
      text: `${unused.name} renews ${date(unused.next)}${unused.lastUsed ? `. You haven't used it in ${daysSince(unused.lastUsed)} days` : ", and you said you don't use it"}. Cancel to save ${formatINR(yearlyCost(unused))} a year.`,
    });
  const hike = subscriptions.find((s) => s.alerts.includes("price-up"));
  if (hike?.previousAmount)
    nudges.push({
      kind: "subscription",
      to: "/subscriptions",
      text: `${hike.name} went from ${formatINR(hike.previousAmount)} to ${formatINR(hike.amount)}. That's ${formatINR(yearlyCost({ ...hike, amount: hike.amount - hike.previousAmount }))} more a year.`,
    });
  const fresh = subscriptions.find((s) => s.alerts.includes("new"));
  if (fresh)
    nudges.push({
      kind: "subscription",
      to: "/subscriptions",
      text: `New autopay: ${fresh.name} at ${formatINR(fresh.amount)}/${fresh.cycle === "Yearly" ? "year" : "month"}. Did you mean to sign up?`,
    });
  const miscat = transactions.find((t) => suggestions.has(t.id));
  if (miscat)
    nudges.push({
      kind: "category",
      to: "/transactions",
      text: `A ${miscat.merchant} spend is under ${miscat.category}, but you usually file it as ${suggestions.get(miscat.id)}. Fix it so your numbers stay honest.`,
    });
  const ef = goals.find((g) => g.emergency);
  if (ef?.status === "At risk")
    nudges.push({ kind: "goal", to: "/goals", text: `Emergency fund is at risk. ${ef.note}` });
  return nudges;
}
