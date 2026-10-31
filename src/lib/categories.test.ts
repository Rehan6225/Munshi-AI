import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_GROUPS, isFixed, isSaving, migrateCategory } from "./categories";
import { parseCommand } from "./parse-command";
import { monthlyInvested, monthlySpend, planGoals } from "./plan";
import { detectRecurring } from "./recurring";
import { parseRuleCommand } from "./rules";
import type { Category, Transaction } from "./store";

const NOW = new Date("2026-10-31T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
const tx = (
  merchant: string,
  category: Category,
  amount: number,
  daysAgo: number,
): Transaction => ({
  id: `${merchant}${daysAgo}`,
  merchant,
  category,
  amount,
  date: ago(daysAgo),
});

describe("the 18 categories", () => {
  it("has 18 categories in 4 groups, each listed once", () => {
    expect(CATEGORIES).toHaveLength(18);
    expect(CATEGORY_GROUPS.flatMap((g) => g.categories).sort()).toEqual([...CATEGORIES].sort());
  });

  it("knows what's fixed and what's saving", () => {
    expect(isFixed("Rent & Housing")).toBe(true);
    expect(isFixed("Household help")).toBe(true);
    expect(isFixed("Food & Dining")).toBe(false);
    expect(isSaving("Savings & Investments")).toBe(true);
  });

  it("maps categories saved by older versions", () => {
    expect(migrateCategory("Food")).toBe("Food & Dining");
    expect(migrateCategory("Bills")).toBe("Utilities");
    expect(migrateCategory("Groceries")).toBe("Groceries");
    expect(migrateCategory("Nonsense")).toBe("Other");
    expect(migrateCategory("toString")).toBe("Other");
  });
});

describe("parseCommand picks the right category", () => {
  it.each<[string, Category]>([
    ["paid 3000 to the maid", "Household help"],
    ["600 for laundry and ironing", "Household help"],
    ["electricity bill 1450", "Utilities"],
    ["jio recharge 299", "Utilities"],
    ["bike emi 3200", "EMIs & Loans"],
    ["paid rent 22000", "Rent & Housing"],
    ["health insurance premium 1250", "Insurance"],
    ["youtube premium 149", "Subscriptions"], // "premium" alone would be insurance
    ["sip 10000 on groww", "Savings & Investments"],
    ["860 at apollo pharmacy", "Health"],
    ["haircut 400", "Personal care"],
    ["flight to goa 6500", "Travel"],
    ["uber 320", "Transport"],
    ["sent 5000 to mom", "Family support"],
    ["tuition fees 4000", "Education"],
    ["480 on swiggy", "Food & Dining"],
    ["1240 on blinkit", "Groceries"],
  ])("%s → %s", (text, category) => {
    expect(parseCommand(text).category).toBe(category);
  });
});

describe("voice corrections with the new names", () => {
  const merchants = ["Maid (Sunita)", "Star Health insurance", "Swiggy"];

  it("understands spoken category names", () => {
    expect(parseRuleCommand("maid should be household help", merchants)?.category).toBe(
      "Household help",
    );
    expect(parseRuleCommand("swiggy is eating out, remember that", merchants)?.category).toBe(
      "Food & Dining",
    );
  });

  it("ignores category words inside the merchant's own name", () => {
    expect(parseRuleCommand("Star Health insurance should be insurance", merchants)).toEqual({
      merchant: "Star Health insurance",
      category: "Insurance",
    });
  });
});

describe("money logic with the new groups", () => {
  it("treats rent and utilities as bills, and gives varying bills no price alerts", () => {
    const subs = detectRecurring(
      [
        tx("BESCOM electricity", "Utilities", 1320, 62),
        tx("BESCOM electricity", "Utilities", 1390, 32),
        tx("BESCOM electricity", "Utilities", 1610, 2),
      ],
      {},
      NOW,
    );
    expect(subs[0]).toMatchObject({ kind: "bill", alerts: [] });
    expect(subs[0]!.previousAmount).toBeUndefined();
  });

  it("doesn't count a SIP as spending, but keeps it out of goal money", () => {
    const txs = [
      tx("Swiggy", "Food & Dining", 1000, 2),
      tx("Groww SIP", "Savings & Investments", 10000, 3),
    ];
    expect(monthlySpend(txs, NOW)).toBe(1000);
    expect(monthlyInvested(txs, NOW)).toBe(10000);

    const goal = { id: "g", name: "Trip", target: 100000, saved: 0, due: ago(-300) };
    const [withSip] = planGoals(
      [goal],
      { income: 50000, spend: 1000, fixed: 0, emergencyMonths: 6, invested: 10000 },
      NOW,
    );
    expect(withSip!.sharePerMonth).toBe(39000);
  });
});

describe("investments", () => {
  it("never show up as subscriptions or bills", () => {
    const sip = [
      tx("Groww SIP", "Savings & Investments", 10000, 62),
      tx("Groww SIP", "Savings & Investments", 10000, 32),
      tx("Groww SIP", "Savings & Investments", 10000, 2),
    ];
    expect(detectRecurring(sip, {}, NOW)).toEqual([]);
  });
});
