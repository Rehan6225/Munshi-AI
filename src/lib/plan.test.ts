import { describe, expect, it } from "vitest";
import { fixedCosts, monthlySpend, planGoals, type Goal } from "./plan";
import { detectRecurring } from "./recurring";
import type { Transaction } from "./store";

const NOW = new Date("2026-10-31T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
const inMonths = (m: number) => new Date(NOW + m * 30.44 * 86400000).toISOString();
const tx = (
  merchant: string,
  amount: number,
  daysAgo: number,
  category: Transaction["category"] = "Food",
) => ({
  id: `${merchant}${daysAgo}`,
  merchant,
  category,
  amount,
  date: ago(daysAgo),
});

describe("monthlySpend", () => {
  it("counts only the last 30 days", () => {
    expect(
      monthlySpend([tx("Swiggy", 500, 2), tx("Zomato", 300, 29), tx("Old", 9999, 31)], NOW),
    ).toBe(800);
  });
});

describe("fixedCosts", () => {
  it("adds detected bills to costs the user typed in", () => {
    const subs = detectRecurring(
      [
        tx("House rent", 22000, 34, "Bills"),
        tx("House rent", 22000, 4, "Bills"),
        tx("Netflix", 649, 32),
        tx("Netflix", 649, 2),
      ],
      {},
      NOW,
    );
    const { items, total } = fixedCosts(subs, {
      income: 0,
      emergencyMonths: 6,
      extraFixedCosts: [{ id: "emi", name: "Car EMI", amount: 8000 }],
    });
    // Netflix is a subscription, not a fixed cost.
    expect(items.map((i) => i.name)).toEqual(["House rent", "Car EMI"]);
    expect(total).toBe(30000);
  });
});

describe("planGoals", () => {
  const base = { income: 100000, spend: 40000, fixed: 25000, emergencyMonths: 6 };
  const goal = (g: Partial<Goal>): Goal => ({
    id: "x",
    name: "Goal",
    target: 100000,
    saved: 0,
    due: inMonths(10),
    ...g,
  });

  it("sizes the emergency fund from spending", () => {
    const [ef] = planGoals([goal({ emergency: true, saved: 60000 })], base, NOW);
    expect(ef!.target).toBe(240000);
    expect(ef!.pct).toBe(25);
  });

  it("uses fixed costs when spending is lower, so a fresh profile still gets a target", () => {
    const [ef] = planGoals([goal({ emergency: true })], { ...base, spend: 0 }, NOW);
    expect(ef!.target).toBe(150000);
  });

  it("splits leftover money equally and grades each goal against its share", () => {
    // ₹60k left over, two open goals → ₹30k each.
    const [risky, easy] = planGoals(
      [
        goal({ id: "a", target: 400000, due: inMonths(10) }),
        goal({ id: "b", target: 100000, due: inMonths(10) }),
      ],
      base,
      NOW,
    );
    expect(risky!.sharePerMonth).toBe(30000);
    expect(risky!.status).toBe("At risk"); // needs ₹40k/month
    expect(easy!.status).toBe("Ahead"); // needs ₹10k/month
  });

  it("is on track when the share just covers the need", () => {
    const [g] = planGoals(
      [goal({ target: 50000, due: inMonths(1) })],
      { ...base, spend: 50000 },
      NOW,
    );
    expect(g!.status).toBe("On track");
  });

  it("marks funded goals done and doesn't give them a share", () => {
    const [done, open] = planGoals(
      [goal({ id: "a", saved: 100000 }), goal({ id: "b" })],
      base,
      NOW,
    );
    expect(done!.status).toBe("Done");
    expect(open!.sharePerMonth).toBe(60000);
  });

  it("flags a missed deadline", () => {
    const [g] = planGoals([goal({ due: ago(10) })], base, NOW);
    expect(g!.status).toBe("At risk");
    expect(g!.note).toMatch(/deadline has passed/);
  });
});
