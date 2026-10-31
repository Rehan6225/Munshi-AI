import { describe, expect, it } from "vitest";
import { detectRecurring, parseUsageCommand } from "./recurring";
import type { Category, Transaction } from "./store";

const NOW = new Date("2026-10-31T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString();
let n = 0;
const tx = (
  merchant: string,
  amount: number,
  daysAgo: number,
  category: Category = "Entertainment",
): Transaction => ({
  id: String(n++),
  merchant,
  category,
  amount,
  date: ago(daysAgo),
});

describe("detectRecurring", () => {
  it("finds a monthly subscription and flags a price hike", () => {
    const [netflix] = detectRecurring(
      [
        tx("Netflix", 499, 92),
        tx("Netflix", 499, 62),
        tx("Netflix", 649, 32),
        tx("Netflix", 649, 2),
      ],
      {},
      NOW,
    );
    expect(netflix).toMatchObject({
      name: "Netflix",
      cycle: "Monthly",
      amount: 649,
      previousAmount: 499,
      changedOn: ago(32),
      charges: 4,
    });
    expect(netflix!.alerts).toContain("price-up");
  });

  it("stops flagging a price change after a few months", () => {
    const [netflix] = detectRecurring(
      [
        tx("Netflix", 499, 152),
        tx("Netflix", 649, 122),
        tx("Netflix", 649, 92),
        tx("Netflix", 649, 62),
        tx("Netflix", 649, 32),
        tx("Netflix", 649, 2),
      ],
      {},
      NOW,
    );
    expect(netflix!.alerts).not.toContain("price-up");
    expect(netflix!.previousAmount).toBeUndefined();
  });

  it("ignores irregular spending like food orders", () => {
    expect(
      detectRecurring([tx("Swiggy", 640, 0), tx("Swiggy", 780, 5), tx("Swiggy", 560, 16)], {}, NOW),
    ).toEqual([]);
  });

  it("needs two charges for an unknown merchant", () => {
    expect(detectRecurring([tx("Sharma Traders", 4200, 2, "Other")], {}, NOW)).toEqual([]);
  });

  it("doesn't mistake two different-sized orders a month apart for a subscription", () => {
    expect(
      detectRecurring([tx("Zomato", 520, 26, "Food"), tx("Zomato", 690, 1, "Food")], {}, NOW),
    ).toEqual([]);
  });

  it("lists known services and autopay payments from a single charge", () => {
    const found = detectRecurring(
      [
        tx("Netflix", 649, 2),
        tx("Amazon Prime", 1499, 10, "Shopping"),
        { ...tx("Society Maintenance", 3500, 5, "Bills"), recurring: true },
      ],
      {},
      NOW,
    );
    expect(found.map((r) => [r.name, r.cycle, r.kind, r.alerts])).toEqual([
      ["Society Maintenance", "Monthly", "bill", []],
      // Most expensive first: Netflix is ₹7,788 a year, Prime ₹1,499.
      ["Netflix", "Monthly", "subscription", []],
      ["Amazon Prime", "Yearly", "subscription", []],
    ]);
  });

  it("detects yearly renewals", () => {
    const [prime] = detectRecurring(
      [tx("Amazon Prime", 1499, 625, "Shopping"), tx("Amazon Prime", 1499, 260, "Shopping")],
      {},
      NOW,
    );
    expect(prime?.cycle).toBe("Yearly");
  });

  it("flags subscriptions unused for 45+ days, or that the user disowned", () => {
    const charges = [
      tx("Disney+ Hotstar", 299, 66),
      tx("Disney+ Hotstar", 299, 36),
      tx("Disney+ Hotstar", 299, 6),
    ];
    expect(detectRecurring(charges, { disneyhotstar: ago(124) }, NOW)[0]!.alerts).toContain(
      "unused",
    );
    expect(detectRecurring(charges, { disneyhotstar: null }, NOW)[0]!.alerts).toContain("unused");
    expect(detectRecurring(charges, { disneyhotstar: ago(3) }, NOW)[0]!.alerts).not.toContain(
      "unused",
    );
  });

  it("never flags bills like rent as unused", () => {
    const rent = [
      tx("House rent", 22000, 64, "Bills"),
      tx("House rent", 22000, 34, "Bills"),
      tx("House rent", 22000, 4, "Bills"),
    ];
    const [r] = detectRecurring(rent, { houserent: null }, NOW);
    expect(r).toMatchObject({ kind: "bill" });
    expect(r!.alerts).not.toContain("unused");
  });

  it("marks recently started autopays as new", () => {
    const [yt] = detectRecurring(
      [tx("YouTube Premium", 149, 33), tx("YouTube Premium", 149, 3)],
      {},
      NOW,
    );
    expect(yt!.alerts).toContain("new");
  });
});

describe("parseUsageCommand", () => {
  const subs = detectRecurring(
    [
      tx("Disney+ Hotstar", 299, 36),
      tx("Disney+ Hotstar", 299, 6),
      tx("Netflix", 649, 32),
      tx("Netflix", 649, 2),
      tx("Cult.fit", 1299, 43, "Other"),
      tx("Cult.fit", 1299, 13, "Other"),
    ],
    {},
    NOW,
  );

  it("understands messy spoken check-ins", () => {
    expect(parseUsageCommand("uh honestly I never use hotstar anymore", subs)).toMatchObject({
      action: "unused",
      sub: { name: "Disney+ Hotstar" },
    });
    expect(parseUsageCommand("cancel my Netflix", subs)).toMatchObject({
      action: "cancel",
      sub: { name: "Netflix" },
    });
    expect(parseUsageCommand("watched netflix yesterday", subs)).toMatchObject({ action: "used" });
    expect(parseUsageCommand("went to cult fit today", subs)).toMatchObject({
      action: "used",
      sub: { name: "Cult.fit" },
    });
  });

  it("leaves normal expenses alone", () => {
    expect(parseUsageCommand("spent 480 on Swiggy last night", subs)).toBeNull();
  });
});
