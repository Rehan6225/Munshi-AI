import { describe, expect, it } from "vitest";
import type { Category } from "./categories";
import { buildNudges, driftNudges } from "./nudges";
import { buildReview, monthKey, shiftMonth, totalsByMonth, usualSpend } from "./review";
import type { Transaction } from "./store";

let n = 0;
/** A spend on a given day, `monthsAgo` calendar months before October 2026. */
const tx = (
  category: Category,
  amount: number,
  monthsAgo: number,
  day = 10,
  merchant = "Shop",
): Transaction => ({
  id: String(n++),
  merchant,
  category,
  amount,
  date: new Date(2026, 9 - monthsAgo, day, 12).toISOString(),
});

describe("months", () => {
  it("keys and shifts months across years", () => {
    expect(monthKey(new Date(2026, 9, 31))).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 3)).toBe("2027-01");
  });

  it("totals spending per month, keeping investments separate", () => {
    const m = totalsByMonth([tx("Food & Dining", 500, 0), tx("Savings & Investments", 10000, 0)]);
    expect(m.get("2026-10")).toMatchObject({ spent: 500, invested: 10000 });
  });

  it("works out the usual from the 3 months before", () => {
    const m = totalsByMonth([
      tx("Food & Dining", 9000, 4), // too old to count
      tx("Food & Dining", 3000, 3),
      tx("Food & Dining", 4000, 2),
      tx("Food & Dining", 5000, 1),
      tx("Food & Dining", 99999, 0), // the month itself never counts
    ]);
    expect(usualSpend(m, "2026-10", "Food & Dining")).toBe(4000);
  });
});

describe("driftNudges", () => {
  const history = [
    tx("Food & Dining", 4000, 3),
    tx("Food & Dining", 4000, 2),
    tx("Food & Dining", 4000, 1),
  ];

  it("projects the month and nudges when it beats the usual by 15%+", () => {
    // ₹3,000 by the 15th of a 31-day month projects to ₹6,200 against a usual ₹4,000.
    const [n] = driftNudges(
      [...history, tx("Food & Dining", 3000, 0, 5)],
      {},
      new Date(2026, 9, 15),
    );
    expect(n?.kind).toBe("drift");
    expect(n?.text).toMatch(/heading for ₹6,200 this month, ₹2,200 over your usual ₹4,000/);
  });

  it("stays quiet when spending is on pace", () => {
    expect(
      driftNudges([...history, tx("Food & Dining", 2000, 0, 5)], {}, new Date(2026, 9, 15)),
    ).toEqual([]);
  });

  it("uses a budget instead of the usual when one is set", () => {
    const at = new Date(2026, 9, 12);
    const near = driftNudges([tx("Shopping", 2500, 0, 3)], { Shopping: 3000 }, at);
    expect(near[0]?.text).toBe(
      "You've used 83% of your ₹3,000 🛍️ Shopping budget and it's only the 12th.",
    );
    const over = driftNudges([tx("Shopping", 3400, 0, 3)], { Shopping: 3000 }, at);
    expect(over[0]?.text).toMatch(/gone past your ₹3,000 🛍️ Shopping budget: ₹3,400/);
  });

  it("never nags about bills or medicine", () => {
    const bills = [3, 2, 1, 0].map((m) => tx("Rent & Housing", m === 0 ? 40000 : 20000, m));
    const health = [3, 2, 1, 0].map((m) => tx("Health", m === 0 ? 9000 : 1000, m));
    expect(driftNudges([...bills, ...health], {}, new Date(2026, 9, 20))).toEqual([]);
  });
});

describe("buildReview", () => {
  const goals = [] as Parameters<typeof buildReview>[0]["goals"];

  it("compares the month with the one before and finds wins and suggestions", () => {
    const r = buildReview({
      transactions: [
        tx("Food & Dining", 4000, 1),
        tx("Groceries", 6000, 1),
        tx("Food & Dining", 6000, 0),
        tx("Groceries", 5000, 0),
        tx("Savings & Investments", 10000, 0),
      ],
      month: "2026-10",
      income: 50000,
      subscriptions: [],
      goals,
    });
    expect(r).toMatchObject({
      spent: 11000,
      invested: 10000,
      saved: 39000,
      savingsRate: 78,
      previousSpent: 10000,
      change: 10,
    });
    expect(r.categories[0]).toMatchObject({
      category: "Food & Dining",
      amount: 6000,
      previous: 4000,
      change: 50,
    });
    expect(r.wins[0]).toBe("🥦 Groceries down ₹1,000 from last month.");
    expect(r.suggestions[0]).toMatch(/^🍕 Food & Dining rose ₹2,000 \(\+50%\)/);
    expect(r.trend.map((t) => t.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sept", "Oct"]);
  });

  it("never suggests cutting health spending", () => {
    const r = buildReview({
      transactions: [tx("Health", 200, 1), tx("Health", 5000, 0)],
      month: "2026-10",
      income: 50000,
      subscriptions: [],
      goals,
    });
    expect(r.suggestions.join(" ")).not.toMatch(/Health/);
  });
});

describe("buildNudges", () => {
  it("puts spending drift ahead of the other heads-ups", () => {
    const history = [3, 2, 1].map((m) => tx("Food & Dining", 4000, m));
    const nudges = buildNudges({
      transactions: [...history, tx("Food & Dining", 6000, 0, 2)],
      subscriptions: [],
      suggestions: new Map(),
      goals: [],
      budgets: {},
      now: new Date(2026, 9, 20),
    });
    expect(nudges[0]?.kind).toBe("drift");
  });
});
