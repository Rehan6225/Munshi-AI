import { describe, expect, it } from "vitest";
import { buildNudges } from "../nudges";
import { fixedCosts, monthlyInvested, monthlySpend, planGoals } from "../plan";
import { detectRecurring } from "../recurring";
import { suggestCategories } from "../rules";
import { DEMO_GOALS, DEMO_PROFILE, demoTransactions, demoUsage, type Transaction } from "../store";
import { parseCsv } from "./csv";
import { toDrafts } from "./rows";
import { sampleCsv, sampleSms } from "./samples";
import { parseSms } from "./sms";

const NOW = new Date(2026, 9, 31, 12);
const DAY = 86400000;

/** What the import dialog would add. */
function imported(rows: ReturnType<typeof parseCsv>): Transaction[] {
  return toDrafts(rows, [])
    .filter((d) => d.selected)
    .map((d, i) => ({
      id: String(i),
      merchant: d.merchant,
      category: d.category,
      amount: d.amount,
      date: d.date,
      ...(d.recurring && { recurring: true }),
    }));
}

/** What the dashboard and Money profile would show, with the profile a sample import fills in. */
function dashboard(txs: Transaction[]) {
  const subscriptions = detectRecurring(txs, demoUsage(NOW), NOW.getTime());
  const spend = monthlySpend(txs, NOW.getTime());
  const invested = monthlyInvested(txs, NOW.getTime());
  const fixed = fixedCosts(subscriptions, DEMO_PROFILE);
  const goals = planGoals(
    DEMO_GOALS,
    { income: DEMO_PROFILE.income, spend, invested, fixed: fixed.total, emergencyMonths: 6 },
    NOW.getTime(),
  );
  const nudges = buildNudges({
    transactions: txs,
    subscriptions,
    suggestions: suggestCategories(txs),
    goals,
    budgets: DEMO_PROFILE.budgets,
    now: NOW,
  });
  return { subscriptions, fixed, goals, nudges };
}

const totals = (txs: Transaction[]) => {
  const out: Record<string, number> = {};
  for (const t of txs) out[t.category] = (out[t.category] ?? 0) + t.amount;
  return out;
};

describe("sample files", () => {
  // The demo files one Swiggy order under Groceries on purpose; a bank statement can't.
  const demo = demoTransactions(NOW)
    .filter((t) => NOW.getTime() - new Date(t.date).getTime() <= 270 * DAY)
    .map((t) =>
      t.merchant === "Swiggy" && t.category === "Groceries"
        ? { ...t, category: "Food & Dining" as const }
        : t,
    );
  const sample = imported(parseCsv(sampleCsv(NOW)));

  it("the CSV holds the demo's spending, filed under the same categories", () => {
    expect(sample).toHaveLength(demo.length);
    expect(totals(sample)).toEqual(totals(demo));
    const credits = parseCsv(sampleCsv(NOW)).filter((r) => r.direction === "credit");
    expect(credits.filter((r) => r.amount === DEMO_PROFILE.income).length).toBeGreaterThan(5);
  });

  it("the CSV gives the demo's fixed costs and subscriptions", () => {
    const mine = dashboard(sample);
    const theirs = dashboard(demo);
    expect(mine.fixed.items.map((i) => i.name)).toEqual([
      "House Rent",
      "Bike Emi Bajaj Fin",
      "Sunita Maid",
      "Bescom",
      "Star Health Insurance",
      "Airtel Broadband",
      "Laundry Raju",
    ]);
    expect(Math.round(mine.fixed.total)).toBe(Math.round(theirs.fixed.total));
    expect(mine.subscriptions.map((s) => [s.cycle, s.alerts])).toEqual(
      theirs.subscriptions.map((s) => [s.cycle, s.alerts]),
    );
  });

  it("the CSV brings up the demo's nudges and goal statuses", () => {
    const mine = dashboard(sample);
    const theirs = dashboard(demo);
    expect(mine.nudges.map((n) => n.kind)).toEqual(
      theirs.nudges.map((n) => n.kind).filter((k) => k !== "category"),
    );
    expect(mine.goals.map((g) => g.status)).toEqual(theirs.goals.map((g) => g.status));
  });

  it("the SMS batch skips the OTP and finds the e-mandates and fixed costs", () => {
    const { rows, skipped } = parseSms(sampleSms(NOW), NOW);
    expect(skipped).toBe(1);
    const drafts = toDrafts(rows, []);
    expect(drafts.filter((d) => d.selected).map((d) => `${d.merchant}: ${d.category}`)).toEqual(
      expect.arrayContaining([
        "House Rent: Rent & Housing",
        "Bike Emi Bajaj Fin: EMIs & Loans",
        "Bescom Electricity: Utilities",
        "Sunita Maid: Household help",
        "Netflix: Subscriptions",
      ]),
    );
  });
});
