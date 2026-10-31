import { describe, expect, it } from "vitest";
import type { Goal } from "./plan";
import type { Recurring } from "./recurring";
import { EMPTY_SCENARIO, buildBaseline, simulate } from "./simulate";
import type { Transaction } from "./store";

const NOW = new Date(2026, 9, 31, 12);
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();
const tx = (merchant: string, amount: number, days: number, category: Transaction["category"]) => ({
  id: merchant + days,
  merchant,
  amount,
  category,
  date: ago(days),
});
const netflix = {
  key: "netflix",
  name: "Netflix",
  kind: "subscription",
  cycle: "Monthly",
  amount: 649,
} as Recurring;
const profile = { income: 50000, emergencyMonths: 6, extraFixedCosts: [], budgets: {} };

describe("buildBaseline", () => {
  it("uses the last 30 days, keeps recurring payments apart and counts SIPs as saving", () => {
    const base = buildBaseline(
      profile,
      [
        tx("Swiggy", 600, 2, "Food & Dining"),
        tx("Swiggy", 400, 45, "Food & Dining"),
        tx("Netflix", 649, 3, "Subscriptions"),
        tx("Groww SIP", 5000, 4, "Savings & Investments"),
      ],
      [netflix],
      NOW,
    );
    expect(base.everyday).toEqual({ "Food & Dining": 600 });
    expect(base.invested).toBe(5000);
    expect(base.recurring).toEqual([
      { key: "netflix", name: "Netflix", kind: "subscription", monthly: 649 },
    ]);
  });
});

describe("simulate", () => {
  const base = {
    income: 50000,
    everyday: { "Food & Dining": 10000, Transport: 4000 } as const,
    recurring: [{ key: "netflix", name: "Netflix", kind: "subscription" as const, monthly: 1000 }],
    invested: 0,
    extraFixed: 0,
    emergencyMonths: 6,
  };
  const trip: Goal = { id: "trip", name: "Trip", target: 100000, saved: 0, due: ago(-365) };

  it("adds up cuts, cancellations, income and an EMI", () => {
    const out = simulate(
      base,
      {
        ...EMPTY_SCENARIO,
        cuts: { "Food & Dining": 50 },
        cancel: ["netflix"],
        incomeChange: 5000,
        emi: 2000,
      },
      [],
      NOW,
    );
    expect(out.leftBefore).toBe(50000 - 15000);
    expect(out.difference).toBe(5000 + 1000 - 2000 + 5000);
  });

  it("moves goal dates with what's left each month", () => {
    // ₹1,00,000 to go: 3 months at ₹35,000 a month; 2 months at ₹50,000.
    const out = simulate(base, { ...EMPTY_SCENARIO, incomeChange: 15000 }, [trip], NOW);
    expect(out.goals[0]).toMatchObject({ before: "2027-01", after: "2026-12", shift: 1 });
  });

  it("takes a purchase out of the chosen goal's savings", () => {
    const saved = { ...trip, saved: 70000 };
    const out = simulate(
      base,
      { ...EMPTY_SCENARIO, purchase: 70000, goalId: "trip" },
      [saved],
      NOW,
    );
    expect(out.goals[0]!.shift).toBe(-2);
  });
});
