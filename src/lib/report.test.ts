import { describe, expect, it } from "vitest";
import { buildMonthReport, monthsWithData } from "./report";
import type { Category, Transaction } from "./store";

let n = 0;
const tx = (merchant: string, amount: number, date: string, category: Category): Transaction => ({
  id: String(n++),
  merchant,
  category,
  amount,
  date: new Date(`${date}T12:00:00`).toISOString(),
});

const txs = [
  tx("Swiggy", 3000, "2026-09-10", "Food"),
  tx("DMart", 4000, "2026-09-12", "Groceries"),
  tx("Swiggy", 2500, "2026-10-05", "Food"),
  tx("Social", 2500, "2026-10-12", "Food"),
  tx("DMart", 3000, "2026-10-08", "Groceries"),
];

describe("buildMonthReport", () => {
  const r = buildMonthReport(
    { transactions: txs, subscriptions: [], goals: [], income: 50000 },
    "2026-10",
  );

  it("adds up the month and the savings rate", () => {
    expect(r).toMatchObject({
      label: "October 2026",
      spent: 8000,
      saved: 42000,
      savingsRate: 84,
      count: 3,
    });
    expect(r.categories.map((c) => [c.category, c.amount])).toEqual([
      ["Food", 5000],
      ["Groceries", 3000],
    ]);
  });

  it("compares with last month and explains the biggest moves", () => {
    expect(r.previousLabel).toBe("September 2026");
    expect(r.changes[0]).toEqual({ category: "Food", now: 5000, before: 3000, diff: 2000 });
    expect(r.highlights.map((h) => h.text)).toEqual([
      "You kept ₹42,000, 84% of your income.",
      "Food was your biggest spend at ₹5,000 (63%).",
      "Food is up ₹2,000 on Sept (+67%).",
      "Groceries is down ₹1,000 on Sept.",
    ]);
  });

  it("groups merchants and builds a six-month trend ending this month", () => {
    expect(r.merchants[0]).toEqual({ name: "DMart", count: 1, amount: 3000 });
    expect(r.trend.map((t) => t.amount)).toEqual([0, 0, 0, 0, 7000, 8000]);
  });
});

describe("monthsWithData", () => {
  it("lists months newest first", () => {
    expect(monthsWithData(txs)).toEqual(["2026-10", "2026-09"]);
  });
});
