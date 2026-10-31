import { CATEGORIES, CATEGORY_INFO, isSaving, type Category } from "./categories";
import { formatINR } from "./format";
import { parseCommand } from "./parse-command";
import type { GoalPlan } from "./plan";
import { merchantKey, yearlyCost, type Recurring } from "./recurring";
import type { Transaction } from "./store";

const DAY = 86400000;

/** Everything the coach knows about the user's money, in one small object. */
export interface CoachSnapshot {
  income: number;
  spend: number;
  invested: number;
  fixed: number;
  /** Left each month after spending and investments. */
  free: number;
  savingsRate: number | null;
  byCategory: { category: Category; amount: number }[];
  byMerchant: { merchant: string; amount: number; count: number }[];
  subscriptions: {
    name: string;
    amount: number;
    cycle: string;
    alerts: string[];
    yearly: number;
  }[];
  goals: {
    name: string;
    target: number;
    saved: number;
    due: string;
    status: string;
    neededPerMonth: number;
    emergency: boolean;
  }[];
}

export function buildSnapshot({
  transactions,
  income,
  spend,
  invested,
  fixed,
  subscriptions,
  goals,
  now = Date.now(),
}: {
  transactions: Transaction[];
  income: number;
  spend: number;
  invested: number;
  fixed: number;
  subscriptions: Recurring[];
  goals: GoalPlan[];
  now?: number;
}): CoachSnapshot {
  const recent = transactions.filter(
    (t) => now - new Date(t.date).getTime() < 30 * DAY && !isSaving(t.category),
  );
  const cats = new Map<Category, number>();
  const merchants = new Map<string, { merchant: string; amount: number; count: number }>();
  for (const t of recent) {
    cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
    const m = merchants.get(merchantKey(t.merchant)) ?? {
      merchant: t.merchant,
      amount: 0,
      count: 0,
    };
    merchants.set(merchantKey(t.merchant), {
      ...m,
      amount: m.amount + t.amount,
      count: m.count + 1,
    });
  }
  return {
    income,
    spend,
    invested,
    fixed: Math.round(fixed),
    free: income - spend - invested,
    savingsRate: income > 0 ? Math.max(0, Math.round(((income - spend) / income) * 100)) : null,
    byCategory: [...cats]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMerchant: [...merchants.values()].sort((a, b) => b.amount - a.amount).slice(0, 15),
    subscriptions: subscriptions
      .filter((s) => s.kind === "subscription")
      .map((s) => ({
        name: s.name,
        amount: s.amount,
        cycle: s.cycle,
        alerts: s.alerts,
        yearly: yearlyCost(s),
      })),
    goals: goals.map((g) => ({
      name: g.name,
      target: g.target,
      saved: g.saved,
      due: g.due.slice(0, 10),
      status: g.status,
      neededPerMonth: Math.round(g.neededPerMonth),
      emergency: !!g.emergency,
    })),
  };
}

const inr = formatINR;
const CUTTABLE: Category[] = [
  "Food & Dining",
  "Shopping",
  "Entertainment",
  "Personal care",
  "Travel",
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "by March", "in 3 months", "next month" → months from now (at least 1). */
export function monthsAhead(question: string, now = new Date()) {
  const q = question.toLowerCase();
  const inN = q.match(/\b(?:in|within|after)\s+(\d{1,2})\s+months?\b/);
  if (inN) return Math.max(1, Number(inN[1]));
  if (/\bnext month\b/.test(q)) return 1;
  if (/\bnext year\b/.test(q)) return 12;
  const named = MONTHS.findIndex((m) => new RegExp(`\\b${m}[a-z]*\\b`).test(q));
  if (named >= 0) {
    const diff = (named - now.getMonth() + 12) % 12;
    return diff === 0 ? 12 : diff;
  }
  return null;
}

function mentionedCategory(q: string): Category | null {
  const lower = q.toLowerCase();
  const byName = CATEGORIES.find((c) => lower.includes(c.toLowerCase()));
  if (byName) return byName;
  const guess = parseCommand(q).category;
  return guess === "Other" ? null : guess;
}

/** Answers common questions from the snapshot, without any AI. */
export function answerLocally(question: string, s: CoachSnapshot): string {
  const q = question.toLowerCase();
  const top = s.byCategory.slice(0, 3);

  // "Can I afford a 40k phone by March?"
  const amount = parseCommand(question).amount;
  if (amount && /\b(afford|can i (?:buy|get|spend)|enough|budget for|plan for)\b/.test(q)) {
    const months = monthsAhead(question) ?? 1;
    if (s.income <= 0)
      return "Add your income in Money profile first, then I can tell you what you can afford.";
    if (s.free <= 0)
      return `Right now nothing is left over: you spend ${inr(s.spend)} and invest ${inr(s.invested)} of your ${inr(s.income)} income. Let's cut something first.`;
    const byThen = s.free * months;
    const when = months === 1 ? "this month" : `in ${months} months`;
    if (amount <= byThen) {
      const share = Math.round((amount / byThen) * 100);
      return `Yes. You have about ${inr(s.free)} left each month, so ${when} you'd have ${inr(byThen)}. ${inr(amount)} would take ${share}% of that, so your goals would slow down a little.`;
    }
    const need = Math.ceil(amount / s.free);
    return `Not ${when}. With about ${inr(s.free)} left each month, ${inr(amount)} takes about ${need} months. Cutting ${top.find((t) => CUTTABLE.includes(t.category))?.category ?? "eating out"} would get you there faster.`;
  }

  // "How much did I spend on Swiggy / food?"
  if (/\b(how much|spent|spend|kitna)\b/.test(q)) {
    const merchant = s.byMerchant.find((m) =>
      m.merchant
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((w) => w.length >= 4 && q.includes(w)),
    );
    if (merchant)
      return `In the last 30 days you spent ${inr(merchant.amount)} at ${merchant.merchant}, over ${merchant.count} payment${merchant.count > 1 ? "s" : ""}.`;
    const cat = mentionedCategory(question);
    if (cat) {
      const total = s.byCategory.find((c) => c.category === cat)?.amount ?? 0;
      return `In the last 30 days you spent ${inr(total)} on ${CATEGORY_INFO[cat].emoji} ${cat}.`;
    }
  }

  // "Where did my money go?"
  if (/\b(where|breakdown|biggest|most|money go|paisa)\b/.test(q) && top.length) {
    const list = top
      .map((t) => `${CATEGORY_INFO[t.category].emoji} ${t.category} ${inr(t.amount)}`)
      .join(", ");
    return `In the last 30 days you spent ${inr(s.spend)}. The biggest chunks: ${list}.`;
  }

  // "How can I save more?"
  if (/\b(save|saving more|cut|reduce|bachat|kam)\b/.test(q) && !/\bsavings rate\b/.test(q)) {
    const unused = s.subscriptions.filter((x) => x.alerts.includes("unused"));
    const cuttable = s.byCategory.find((c) => CUTTABLE.includes(c.category));
    const ideas = [
      unused.length &&
        `Cancel ${unused.map((u) => u.name).join(" and ")}, which you don't use: ${inr(unused.reduce((t, u) => t + u.yearly, 0))} a year.`,
      cuttable &&
        `Cut ${cuttable.category} by 30%: about ${inr(cuttable.amount * 0.3)} a month, ${inr(cuttable.amount * 0.3 * 12)} a year.`,
    ].filter(Boolean);
    return ideas.length
      ? `Two easy wins:\n• ${ideas.join("\n• ")}`
      : "You're already lean. Look at your biggest category on the dashboard and try trimming 10% there.";
  }

  // Plain-language explanations: education is allowed, picks are not.
  if (/\b(what is|what's|explain|how does|difference|vs)\b/.test(q)) {
    if (/\bsip\b/.test(q))
      return "A SIP (systematic investment plan) puts a fixed amount into an investment every month automatically. It builds the habit and averages out market ups and downs.";
    if (/\bindex fund/.test(q))
      return "An index fund buys every company in a market index, like the Nifty 50, so you own a slice of the whole market. Costs are low and you don't have to pick winners.";
    if (/\bemergency fund/.test(q))
      return "An emergency fund is 3–12 months of expenses kept somewhere safe and easy to reach, for job loss or medical bills. Build it before taking investment risk.";
  }

  if (/\bsubscriptions?\b/.test(q)) {
    if (!s.subscriptions.length) return "I haven't spotted any subscriptions yet.";
    const total = s.subscriptions.reduce((t, x) => t + x.yearly, 0);
    const flagged = s.subscriptions.filter((x) => x.alerts.length);
    return `You have ${s.subscriptions.length} subscriptions costing ${inr(total)} a year.${flagged.length ? ` Worth a look: ${flagged.map((f) => `${f.name} (${f.alerts.join(", ")})`).join(", ")}.` : ""}`;
  }

  // "Am I on track?", "emergency fund", or a goal by name
  const generic = new Set(["fund", "goal", "new", "save", "saving", "money"]);
  const goal = s.goals.find((g) =>
    g.name
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length >= 3 && !generic.has(w) && q.includes(w)),
  );
  if (goal || /\b(goals?|on track|emergency)\b/.test(q)) {
    const list = goal ? [goal] : s.goals;
    if (!list.length) return "You haven't set any goals yet. Add one in Money profile.";
    return list
      .map(
        (g) =>
          `${g.name}: ${g.status}. ${inr(g.saved)} of ${inr(g.target)}, needs about ${inr(g.neededPerMonth)}/month to finish by ${new Date(g.due).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}.`,
      )
      .join("\n");
  }

  if (/\bsavings rate\b|\bhow much (?:am i|do i) sav/.test(q) && s.savingsRate !== null)
    return `Your savings rate is ${s.savingsRate}%. ${s.savingsRate >= 30 ? "That's healthy, nice!" : "Aim for 30% by trimming one lifestyle category."}`;

  return "I can help with questions like: “Where did my money go?”, “Can I afford a ₹40k phone by March?”, “How much did I spend on Swiggy?”, “How can I save more?” or “Am I on track for my goals?”";
}

export const COACH_SYSTEM_PROMPT = `You are Munshi ji, a warm personal finance coach for Indian users. You answer using ONLY the user's numbers in the snapshot you're given. Currency is INR (use ₹ and Indian digit grouping like ₹1,00,000).

Style: friendly, plain English with an occasional Hinglish touch ("Achha", "bilkul"). At most 90 words. Short sentences. Use "•" bullets for lists. No markdown headings or bold.

Hard rules:
- Never recommend, rate or name specific stocks, shares, mutual funds, fund houses, ETFs, IPOs or crypto, even if asked directly or hypothetically. Instead, explain the concept (index funds vs stock picking, emergency fund first, SIPs) and suggest a SEBI-registered investment adviser.
- Don't invent numbers. If the snapshot doesn't have it, say so.
- You can model scenarios ("if you cut eating out by 30%...") with simple arithmetic from the snapshot.`;
