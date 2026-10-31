import { describe, expect, it } from "vitest";
import { cleanSpeech, parseLocally, sanitizeAiParse, segmentSpeech } from "./voice";
import { detectRecurring } from "./recurring";

const NOW = Date.now();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
const ctx = {
  merchants: ["Swiggy", "Zomato", "Uber", "Disney+ Hotstar"],
  subscriptions: detectRecurring(
    [
      {
        id: "a",
        merchant: "Disney+ Hotstar",
        category: "Entertainment",
        amount: 299,
        date: ago(36),
      },
      {
        id: "b",
        merchant: "Disney+ Hotstar",
        category: "Entertainment",
        amount: 299,
        date: ago(6),
      },
    ],
    {},
  ),
};

describe("segmentSpeech", () => {
  it("marks fillers and self-corrections", () => {
    const heard = segmentSpeech("uh spent like 450, no wait, 480 on swiggy last night");
    expect(heard.filter((s) => s.kind === "filler").map((s) => s.text.trim())).toEqual([
      "uh",
      "like",
    ]);
    expect(heard.find((s) => s.kind === "corrected")?.text).toBe("450, no wait, ");
    expect(heard.map((s) => s.text).join("")).toBe(
      "uh spent like 450, no wait, 480 on swiggy last night",
    );
    expect(cleanSpeech(heard)).toBe("spent 480 on swiggy last night");
  });

  it("leaves clean sentences alone", () => {
    expect(segmentSpeech("paid 1,200 for groceries at DMart")).toEqual([
      { text: "paid 1,200 for groceries at DMart", kind: "keep" },
    ]);
  });

  it("doesn't treat 'also' as the filler 'so'", () => {
    expect(segmentSpeech("also 200 on uber").every((s) => s.kind === "keep")).toBe(true);
  });
});

describe("parseLocally", () => {
  it("keeps the corrected amount", () => {
    expect(
      parseLocally("uh so I spent like 450, no wait, 480 on Swiggy last night", ctx).actions,
    ).toEqual([{ type: "expense", amount: 480, merchant: "Swiggy", category: "Food", daysAgo: 1 }]);
  });

  it("splits several spends in one sentence", () => {
    const { actions } = parseLocally("paid 200 auto and 150 chai with friends", ctx);
    expect(actions).toEqual([
      { type: "expense", amount: 200, merchant: "Auto", category: "Transport", daysAgo: 0 },
      { type: "expense", amount: 150, merchant: "Chai", category: "Food", daysAgo: 0 },
    ]);
  });

  it("applies a shared date to every spend", () => {
    const { actions } = parseLocally("yesterday 300 on uber, 500 on zomato", ctx);
    expect(actions.map((a) => a.type === "expense" && a.daysAgo)).toEqual([1, 1]);
  });

  it("doesn't split thousands separators", () => {
    expect(parseLocally("paid 1,200 at DMart", ctx).actions).toMatchObject([{ amount: 1200 }]);
  });

  it("understands corrections and subscription check-ins", () => {
    expect(parseLocally("uh, Swiggy is food, not groceries, remember that", ctx).actions).toEqual([
      { type: "rule", merchant: "Swiggy", category: "Food" },
    ]);
    expect(parseLocally("honestly I never use hotstar", ctx).actions).toEqual([
      { type: "subscription", merchant: "Disney+ Hotstar", action: "unused" },
    ]);
  });

  it("returns nothing when there's nothing to do", () => {
    expect(parseLocally("hello munshi", ctx).actions).toEqual([]);
  });
});

describe("sanitizeAiParse", () => {
  const text = "uh 480 on swiggy";

  it("keeps valid actions and the AI's segments when they match the text", () => {
    const parsed = sanitizeAiParse(
      {
        heard: [
          { text: "uh ", kind: "filler" },
          { text: "480 on swiggy", kind: "keep" },
        ],
        actions: [
          { type: "expense", amount: 480, merchant: "Swiggy", category: "Food", daysAgo: 0 },
        ],
      },
      text,
    );
    expect(parsed?.engine).toBe("ai");
    expect(parsed?.heard[0]).toEqual({ text: "uh ", kind: "filler" });
    expect(parsed?.actions).toHaveLength(1);
  });

  it("drops junk and fixes unknown categories", () => {
    const parsed = sanitizeAiParse(
      {
        heard: [{ text: "something else entirely", kind: "keep" }],
        actions: [
          { type: "expense", amount: -5, merchant: "X" },
          { type: "expense", amount: "300", merchant: "Uber", category: "Cabs", daysAgo: 99 },
          { type: "hack", amount: 1 },
        ],
      },
      text,
    );
    expect(parsed?.actions).toEqual([
      { type: "expense", amount: 300, merchant: "Uber", category: "Other", daysAgo: 60 },
    ]);
    // Segments didn't match what was said, so they're rebuilt locally.
    expect(parsed?.heard.map((s) => s.text).join("")).toBe(text);
  });

  it("rejects responses without an actions list", () => {
    expect(sanitizeAiParse({ heard: [] }, text)).toBeNull();
    expect(sanitizeAiParse("nope", text)).toBeNull();
  });
});
