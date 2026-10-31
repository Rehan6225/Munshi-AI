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

describe("sample files", () => {
  const demo = demoTransactions(NOW);
  const drafts = toDrafts(parseCsv(sampleCsv(NOW)), []);
  const sample = imported(parseCsv(sampleCsv(NOW)));

  it("the CSV has 68 spends, a few of which need a look", () => {
    const spends = drafts.filter((d) => d.direction === "debit");
    expect(spends).toHaveLength(68);
    expect(sample).toHaveLength(68);
    // What the review step lists under "need a look".
    const unsure = spends.filter((d) => !d.duplicate && d.confidence !== "high");
    expect(unsure.length).toBeGreaterThanOrEqual(3);
    expect(unsure.length).toBeLessThanOrEqual(4);
    const salary = drafts.filter(
      (d) => d.direction === "credit" && d.amount === DEMO_PROFILE.income,
    );
    expect(salary.length).toBeGreaterThanOrEqual(2);
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

  it("the CSV brings up the same nudges and goal statuses as the demo", () => {
    const mine = dashboard(sample);
    const theirs = dashboard(demo);
    // Same heads-ups; their order depends on how far each one is off.
    const kinds = (n: { kind: string }[]) => n.map((x) => x.kind).sort();
    expect(kinds(mine.nudges)).toEqual(kinds(theirs.nudges));
    expect(mine.nudges).toHaveLength(theirs.nudges.length);
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
