import { describe, expect, it } from "vitest";
import { answerLocally, monthsAhead, type CoachSnapshot } from "./coach";
import { asksForSecurities, guardrailAnswer, namesSecurities } from "./guardrails";

describe("asksForSecurities", () => {
  it.each([
    "which stock should I buy?",
    "best mutual fund for 2027?",
    "suggest some good shares",
    "any stock tips for me",
    "should I buy bitcoin",
    "should I invest in Reliance",
    "is it a good time to sell my TCS shares",
    "kaunsa mutual fund lu",
    "give me a multibagger",
  ])("blocks “%s”", (q) => {
    expect(asksForSecurities(q)).toBe(true);
  });

  it.each([
    "what is a mutual fund?",
    "should I start a SIP?",
    "explain index funds vs stocks",
    "can I afford a 40k phone by March?",
    "how much did I spend on Swiggy?",
    "is my emergency fund enough",
  ])("allows “%s”", (q) => {
    expect(asksForSecurities(q)).toBe(false);
  });
});

describe("namesSecurities", () => {
  it("catches answers that slip in a specific pick", () => {
    expect(namesSecurities("You could try Parag Parikh Flexi Cap.")).toBe(true);
    expect(namesSecurities("Buy INFY.NS on dips")).toBe(true);
    expect(namesSecurities("Keep 6 months of expenses in an emergency fund.")).toBe(false);
  });
});

describe("guardrailAnswer", () => {
  it("declines warmly and teaches instead, using the user's numbers", () => {
    const a = guardrailAnswer({ emergencyPct: 25, invested: 10000 });
    expect(a).toMatch(/can't recommend specific stocks, funds or crypto/);
    expect(a).toMatch(/SEBI-registered/);
    expect(a).toMatch(/you're at 25%/);
    expect(a).toMatch(/₹10,000 a month/);
  });
});

const snap: CoachSnapshot = {
  income: 120000,
  spend: 57600,
  invested: 10000,
  fixed: 32500,
  free: 52400,
  savingsRate: 52,
  byCategory: [
    { category: "Rent & Housing", amount: 22000 },
    { category: "Food & Dining", amount: 5950 },
    { category: "Groceries", amount: 5630 },
  ],
  byMerchant: [
    { merchant: "House rent", amount: 22000, count: 1 },
    { merchant: "Swiggy", amount: 1980, count: 3 },
  ],
  subscriptions: [
    { name: "Disney+ Hotstar", amount: 299, cycle: "Monthly", alerts: ["unused"], yearly: 3588 },
    { name: "Netflix", amount: 649, cycle: "Monthly", alerts: ["price-up"], yearly: 7788 },
  ],
  goals: [
    {
      name: "Emergency fund",
      target: 345798,
      saved: 85000,
      due: "2027-03-01",
      status: "At risk",
      neededPerMonth: 66017,
      emergency: true,
    },
    {
      name: "Goa trip",
      target: 45000,
      saved: 22000,
      due: "2027-01-01",
      status: "On track",
      neededPerMonth: 11430,
      emergency: false,
    },
  ],
};

describe("answerLocally", () => {
  it("says yes to an affordable purchase, with the numbers", () => {
    const a = answerLocally("can I afford a 40k phone next month?", snap);
    expect(a).toMatch(/^Yes\./);
    expect(a).toContain("₹52,400");
  });

  it("says not yet, and how long it takes, when it's too much", () => {
    const a = answerLocally("can I afford a 2 lakh bike next month?", snap);
    expect(a).toMatch(/^Not this month/);
    expect(a).toMatch(/about 4 months/);
  });

  it("totals a merchant or a category", () => {
    expect(answerLocally("how much did I spend on swiggy?", snap)).toContain(
      "₹1,980 at Swiggy, over 3 payments",
    );
    expect(answerLocally("how much on food & dining", snap)).toContain("₹5,950");
  });

  it("explains where the money went", () => {
    expect(answerLocally("where did my money go?", snap)).toMatch(/Rent & Housing ₹22,000/);
  });

  it("finds savings in unused subscriptions and lifestyle spends", () => {
    const a = answerLocally("how can I save more?", snap);
    expect(a).toContain("Cancel Disney+ Hotstar");
    expect(a).toContain("Cut Food & Dining by 30%");
  });

  it("reports goals, by name or all of them", () => {
    expect(answerLocally("how is my goa trip going", snap)).toMatch(/^Goa trip: On track/);
    expect(answerLocally("am I on track?", snap).split("\n")).toHaveLength(2);
  });

  it("explains concepts without naming products", () => {
    const a = answerLocally("what is an index fund?", snap);
    expect(a).toMatch(/Nifty 50/);
    expect(namesSecurities(a)).toBe(false);
  });

  it("offers examples when it doesn't know", () => {
    expect(answerLocally("tell me a joke", snap)).toMatch(/I can help with questions like/);
  });
});

describe("monthsAhead", () => {
  const oct = new Date("2026-10-15T00:00:00Z");
  it("reads common time phrases", () => {
    expect(monthsAhead("by March", oct)).toBe(5);
    expect(monthsAhead("in 3 months", oct)).toBe(3);
    expect(monthsAhead("next month", oct)).toBe(1);
    expect(monthsAhead("someday", oct)).toBeNull();
  });
});
