import { describe, expect, it } from "vitest";
import { findRule, parseRuleCommand, suggestCategories, type Rule } from "./rules";
import type { Category, Transaction } from "./store";

let n = 0;
const tx = (
  merchant: string,
  category: Category,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: String(n++),
  merchant,
  category,
  amount: 500,
  date: "2026-10-30T00:00:00.000Z",
  ...extra,
});

describe("suggestCategories", () => {
  it("flags the odd one out for a merchant", () => {
    const odd = tx("Swiggy", "Groceries");
    const s = suggestCategories([odd, tx("Swiggy", "Food"), tx("Swiggy", "Food")]);
    expect(s.get(odd.id)).toBe("Food");
    expect(s.size).toBe(1);
  });

  it("stays quiet without enough history or a clear majority", () => {
    expect(suggestCategories([tx("Swiggy", "Groceries"), tx("Swiggy", "Food")]).size).toBe(0);
    expect(
      suggestCategories([
        tx("Amazon", "Shopping"),
        tx("Amazon", "Groceries"),
        tx("Amazon", "Entertainment"),
      ]).size,
    ).toBe(0);
  });

  it("never second-guesses a category set by a learned rule", () => {
    const ruled = tx("Swiggy", "Groceries", { ruleId: "r1" });
    expect(
      suggestCategories([ruled, tx("Swiggy", "Food"), tx("Swiggy", "Food")]).has(ruled.id),
    ).toBe(false);
  });
});

describe("findRule", () => {
  const rules: Rule[] = [
    {
      id: "r",
      key: "disneyhotstar",
      merchant: "Disney+ Hotstar",
      category: "Entertainment",
      applied: 0,
      createdAt: "",
    },
  ];
  it("matches merchants regardless of case and punctuation", () => {
    expect(findRule("disney hotstar", rules)?.id).toBe("r");
    expect(findRule("Netflix", rules)).toBeUndefined();
  });
});

describe("parseRuleCommand", () => {
  const merchants = ["Swiggy", "Uber", "Disney+ Hotstar", "Third Wave Coffee"];

  it("picks the category that isn't negated", () => {
    expect(parseRuleCommand("uh, Swiggy is food, not groceries, remember that", merchants)).toEqual(
      {
        merchant: "Swiggy",
        category: "Food",
      },
    );
    expect(parseRuleCommand("swiggy is not groceries, it's eating out", merchants)).toEqual({
      merchant: "Swiggy",
      category: "Food",
    });
    expect(parseRuleCommand("move Swiggy from groceries to food", merchants)).toEqual({
      merchant: "Swiggy",
      category: "Food",
    });
  });

  it("understands different phrasings", () => {
    expect(parseRuleCommand("always put Uber under transport", merchants)?.category).toBe(
      "Transport",
    );
    expect(parseRuleCommand("hotstar should be entertainment from now on", merchants)).toEqual({
      merchant: "Disney+ Hotstar",
      category: "Entertainment",
    });
  });

  it("ignores sentences that aren't corrections", () => {
    expect(parseRuleCommand("Zomato is food", merchants)).toBeNull(); // unknown merchant
    expect(parseRuleCommand("Swiggy was late again", merchants)).toBeNull(); // no category
  });
});
