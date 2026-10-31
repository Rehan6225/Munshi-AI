import { describe, expect, it } from "vitest";
import { EMPTY_SCENARIO, buildBaseline, monthsUntil, planGoal, simulate } from "./plan";
import type { Recurring } from "./recurring";
import type { Goal, GoalInput, Transaction } from "./store";

const NOW = new Date(2026, 9, 31, 12); // 31 Oct 2026
const goal = (patch: Partial<GoalInput>): GoalInput => ({
  id: "g",
  name: "Goal",
  saved: 0,
  target: 100000,
  due: "2027-03",
  monthly: 0,
  ...patch,
});

describe("monthsUntil", () => {
  it("counts whole months from this month", () => {
    expect(monthsUntil("2027-03", NOW)).toBe(5);
    expect(monthsUntil("2026-10", NOW)).toBe(0);
  });
});

describe("planGoal", () => {
  it("is at risk when the monthly amount falls short", () => {
    expect(planGoal(goal({ saved: 85000, target: 300000, monthly: 12000 }), NOW)).toMatchObject({
      status: "At risk",
      needed: 43000,
      note: "Needs ₹43,000/month. You're putting aside ₹12,000.",
    });
  });

  it("is on track when it finishes in the due month", () => {
    expect(
      planGoal(goal({ saved: 28000, target: 45000, due: "2026-12", monthly: 8500 }), NOW).status,
    ).toBe("On track");
  });

  it("is ahead when it finishes early, and says by how much", () => {
    const plan = planGoal(
      goal({ saved: 52000, target: 120000, due: "2027-06", monthly: 9800 }),
      NOW,
    );
    expect(plan.status).toBe("Ahead");
    expect(plan.note).toMatch(/1 month early\.$/);
  });

  it("handles reached goals, missing monthly amounts and past deadlines", () => {
    expect(planGoal(goal({ saved: 100000 }), NOW).status).toBe("Reached");
    expect(planGoal(goal({ monthly: 0 }), NOW).note).toMatch(/Add how much you put aside/);
    expect(planGoal(goal({ due: "2026-08", monthly: 5000 }), NOW).note).toMatch(
      /deadline has passed/,
    );
  });
});

const tx = (
  merchant: string,
  amount: number,
  daysAgo: number,
  category: Transaction["category"],
) => ({
  id: merchant + daysAgo,
  merchant,
  amount,
  category,
  date: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
});
const netflix = {
  key: "netflix",
  name: "Netflix",
  kind: "subscription",
  cycle: "Monthly",
  amount: 649,
} as Recurring;

describe("buildBaseline", () => {
  it("uses the last 30 days and keeps recurring payments separate", () => {
    const base = buildBaseline(
      95000,
      [
        tx("Swiggy", 600, 2, "Food"),
        tx("Swiggy", 400, 45, "Food"),
        tx("Netflix", 649, 3, "Entertainment"),
        tx("Uber", 300, 5, "Transport"),
      ],
      [netflix],
      NOW,
    );
    expect(base.everyday).toEqual({ Food: 600, Transport: 300 });
    expect(base.recurring).toEqual([
      { key: "netflix", name: "Netflix", kind: "subscription", monthly: 649 },
    ]);
  });
});

describe("simulate", () => {
  const base = {
    income: 95000,
    everyday: { Food: 10000, Transport: 3000 },
    recurring: [{ key: "netflix", name: "Netflix", kind: "subscription" as const, monthly: 649 }],
  };
  const trip: Goal = {
    ...goal({ id: "trip", saved: 20000, target: 50000, due: "2027-06", monthly: 5000 }),
    status: "On track",
    note: "",
  };

  it("adds up cuts, cancellations, income and an EMI", () => {
    const out = simulate(
      base,
      { ...EMPTY_SCENARIO, cuts: { Food: 50 }, cancel: ["netflix"], incomeChange: 5000, emi: 2000 },
      [],
      NOW,
    );
    expect(out.leftBefore).toBe(95000 - 13649);
    expect(out.difference).toBe(5000 + 649 - 2000 + 5000);
  });

  it("moves the chosen goal's finish date with the difference", () => {
    const out = simulate(
      base,
      { ...EMPTY_SCENARIO, cuts: { Food: 50 }, goalId: "trip" },
      [trip],
      NOW,
    );
    // ₹30,000 to go: 6 months at ₹5,000, 3 months at ₹10,000.
    expect(out.goals[0]).toMatchObject({ before: "2027-04", after: "2027-01", shift: 3 });
  });

  it("takes a purchase out of the chosen goal", () => {
    const out = simulate(base, { ...EMPTY_SCENARIO, purchase: 20000, goalId: "trip" }, [trip], NOW);
    expect(out.goals[0]!.shift).toBe(-4);
  });
});
