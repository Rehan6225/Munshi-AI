import { describe, expect, it } from "vitest";
import { detectRecurring } from "../recurring";
import type { Transaction } from "../store";
import { parseCsv } from "./csv";
import { toDrafts } from "./rows";
import { sampleCsv, sampleSms } from "./samples";
import { parseSms } from "./sms";

const NOW = new Date(2026, 9, 31, 12);

/** What the import dialog would add, then what Subscriptions would list. */
function subscriptionsFrom(rows: ReturnType<typeof parseCsv>) {
  const txs: Transaction[] = toDrafts(rows, [])
    .filter((d) => d.selected)
    .map((d, i) => ({
      id: String(i),
      merchant: d.merchant,
      category: d.category,
      amount: d.amount,
      date: d.date,
      ...(d.recurring && { recurring: true }),
    }));
  return detectRecurring(txs, {}, NOW.getTime())
    .map((r) => r.name)
    .sort();
}

describe("sample files", () => {
  it("the CSV imports every row and finds its subscriptions and bills", () => {
    const rows = parseCsv(sampleCsv(NOW));
    expect(rows).toHaveLength(31);
    expect(rows.filter((r) => r.direction === "credit")).toHaveLength(2);
    expect(subscriptionsFrom(rows)).toEqual([
      "Airtel Broadband",
      "Amazon Prime",
      "Cultfit",
      "Disney Hotstar",
      "House Rent",
      "Netflix",
      "Spotify",
      "Youtube Premium",
    ]);
  });

  it("the SMS batch skips the OTP and finds the e-mandate subscriptions", () => {
    const { rows, skipped } = parseSms(sampleSms(NOW), NOW);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(13);
    expect(subscriptionsFrom(rows)).toEqual([
      "Airtel Broadband",
      "Amazon Prime",
      "Cultfit",
      "Disney Hotstar",
      "House Rent",
      "Netflix",
      "Spotify",
    ]);
  });
});
