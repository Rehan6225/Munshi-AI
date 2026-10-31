import type { Category, Transaction } from "../store";
import { AUTOPAY, looksRecurring, merchantKey } from "../recurring";
import type { Rule } from "../rules";
import { categorize, cleanMerchant, type Confidence } from "./categorize";

export type ImportSource = "pdf" | "csv" | "sms";

/** One line read out of a statement, CSV or SMS, before any cleanup. */
export interface RawRow {
  date: string; // ISO
  description: string;
  amount: number;
  direction: "debit" | "credit";
  /** The source said it's an autopay, e.g. an e-mandate SMS. */
  autopay?: boolean;
}

/** A row in the review step. */
export interface Draft extends RawRow {
  key: string;
  merchant: string;
  category: Category;
  confidence: Confidence;
  /** Category came from a choice the user made before. */
  remembered: boolean;
  /** Looks like a subscription or bill, so it shows up under Subscriptions. */
  recurring: boolean;
  duplicate: boolean;
  selected: boolean;
}

const DAY = 86400000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reads Indian-style dates: 24/10/2026, 24-10-26, 24-Oct-2026, 24 Oct 26, 2026-10-24. */
export function parseDate(text: string): string | null {
  const s = text.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[\s/-]?([a-z]{3})[a-z]*[\s/,-]*(\d{2,4})\b/i))) {
    d = Number(match[1]);
    m = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    y = Number(match[3]);
  } else {
    return null;
  }
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Noon UTC so the day doesn't shift in Indian or any other timezone.
  return new Date(Date.UTC(y, m - 1, d, 12)).toISOString();
}

/** "1,23,456.78" / "₹ 486" / "(500.00)" → number. */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[₹,\s]|rs\.?|inr/gi, "").replace(/^\((.*)\)$/, "-$1");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Cleans names, picks categories and flags rows that are already in Munshi. */
export function toDrafts(rows: RawRow[], existing: Transaction[], rules: Rule[] = []): Draft[] {
  return rows.map((r, i) => {
    const merchant = cleanMerchant(r.description);
    const { category, confidence, remembered } = categorize(merchant, r.description, rules);
    const t = new Date(r.date).getTime();
    const duplicate =
      r.direction === "debit" &&
      existing.some(
        (e) =>
          Math.abs(e.amount - r.amount) < 0.5 &&
          Math.abs(new Date(e.date).getTime() - t) <= DAY * 1.5 &&
          merchantKey(e.merchant) === merchantKey(merchant),
      );
    return {
      ...r,
      key: `${i}-${r.date}-${r.amount}`,
      merchant,
      category,
      confidence,
      remembered: Boolean(remembered),
      recurring:
        r.direction === "debit" &&
        (Boolean(r.autopay) || AUTOPAY.test(r.description) || looksRecurring({ merchant })),
      duplicate,
      selected: r.direction === "debit" && !duplicate,
    };
  });
}
