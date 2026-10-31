import { describe, expect, it } from "vitest";
import { dailySummary, munshiReply, toSpeech, weeklyAside } from "./munshi";
import type { Transaction } from "./store";

const first = () => 0; // always the first phrasing, so tests are stable

describe("munshiReply", () => {
  it("confirms a single spend in Hinglish", () => {
    const { text } = munshiReply(
      {
        kind: "logged",
        spends: [{ amount: 480, merchant: "Swiggy", category: "Food & Dining", learned: false }],
      },
      first,
    );
    expect(text).toBe("Ho gaya! ₹480 Swiggy pe likh diya, Food & Dining mein.");
  });

  it("mentions when a learned rule picked the category", () => {
    const { text } = munshiReply(
      {
        kind: "logged",
        spends: [{ amount: 300, merchant: "Swiggy", category: "Food & Dining", learned: true }],
      },
      first,
    );
    expect(text).toContain("Aapka rule yaad tha");
  });

  it("totals several spends", () => {
    const { text } = munshiReply(
      {
        kind: "logged",
        spends: [
          { amount: 200, merchant: "Auto", category: "Transport", learned: false },
          { amount: 150, merchant: "Chai", category: "Food & Dining", learned: false },
        ],
      },
      first,
    );
    expect(text).toBe("Done! 2 kharche likh diye, total ₹350.");
  });

  it("covers rules and subscriptions", () => {
    expect(
      munshiReply({ kind: "rule", merchant: "Swiggy", category: "Food & Dining", refiled: 2 }).text,
    ).toBe(
      "Samajh gaya! Ab se Swiggy hamesha Food & Dining mein jayega. Purane 2 bhi theek kar diye.",
    );
    expect(munshiReply({ kind: "cancel", name: "Hotstar", yearly: 3588 }).text).toContain("₹3,588");
    expect(munshiReply({ kind: "not-understood" }).text).toMatch(/samajh nahi aaya/);
  });
});

describe("weeklyAside", () => {
  const now = new Date("2026-10-31T12:00:00Z").getTime();
  const order = (daysAgo: number): Transaction => ({
    id: String(daysAgo),
    merchant: "Swiggy",
    category: "Food & Dining",
    amount: 400,
    date: new Date(now - daysAgo * 86400000).toISOString(),
  });

  it("speaks up on the third order this week", () => {
    expect(weeklyAside("Swiggy", "Food & Dining", [order(0), order(2), order(5)], now)).toEqual({
      text: "Is hafte yeh teesra Swiggy order hai. Thoda dhyan rakhiye 😉",
      hindi: "इस हफ़्ते ये तीसरा Swiggy ऑर्डर है। थोड़ा ध्यान रखिए।",
    });
  });

  it("stays quiet for older orders or essentials", () => {
    expect(
      weeklyAside("Swiggy", "Food & Dining", [order(0), order(9), order(12)], now),
    ).toBeUndefined();
    expect(weeklyAside("Swiggy", "Groceries", [order(0), order(1), order(2)], now)).toBeUndefined();
  });
});

describe("dailySummary", () => {
  it("reads out spend, savings rate and the top nudge", () => {
    expect(dailySummary({ spend: 40000, income: 100000, topNudge: "Netflix went up." }).text).toBe(
      "Namaste! Is mahine ab tak ₹40,000 kharch hue hain. Savings rate 60% hai, bahut badhiya! Ek baat: Netflix went up.",
    );
  });

  it("skips the savings rate without an income", () => {
    expect(dailySummary({ spend: 500, income: 0 }).text).toBe(
      "Namaste! Is mahine ab tak ₹500 kharch hue hain.",
    );
  });
});

describe("the Hindi version", () => {
  it("says the same thing in Devanagari, with amounts a Hindi voice reads well", () => {
    const reply = munshiReply(
      {
        kind: "logged",
        spends: [{ amount: 1200, merchant: "DMart", category: "Groceries", learned: true }],
      },
      first,
    );
    expect(reply.hindi).toBe(
      "हो गया! 1200 रुपये DMart पे लिख दिया, Groceries में। आपका रूल याद था।",
    );
  });

  it("has a Hindi line for every kind of reply", () => {
    const events = [
      { kind: "rule", merchant: "Swiggy", category: "Food & Dining", refiled: 0 },
      { kind: "unused", name: "Hotstar", yearly: 3588 },
      { kind: "cancel", name: "Hotstar", yearly: 3588 },
      { kind: "used", name: "Hotstar", yearly: 3588 },
      { kind: "no-subscription", name: "Zee5" },
      { kind: "not-understood" },
    ] as const;
    for (const e of events) expect(munshiReply(e, first).hindi).toMatch(/[\u0900-\u097F]/);
    expect(dailySummary({ spend: 40000, income: 100000 }).hindi).toBe(
      "नमस्ते! इस महीने अब तक 40000 रुपये खर्च हुए हैं। सेविंग्स रेट 60 प्रतिशत है, बहुत बढ़िया!",
    );
  });
});

describe("toSpeech", () => {
  it("reads rupees naturally and drops emoji and quotes", () => {
    expect(toSpeech("Ho gaya! ₹1,200 “DMart” pe 🎉 Food & Dining")).toBe(
      "Ho gaya! 1200 rupaye DMart pe Food and Dining",
    );
  });
});
