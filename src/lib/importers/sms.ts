import { AUTOPAY } from "../recurring";
import { parseAmount, parseDate, type RawRow } from "./rows";

const AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DATE =
  /\b(\d{1,2}[/.-](?:\d{1,2}|[a-z]{3})[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s?[a-z]{3}\s?\d{2,4})\b/i;
const DEBIT = /debited|spent|sent|paid|withdrawn|purchase|txn of|transaction of|charged|deducted/i;
const CREDIT = /credited|received|deposited|refund(ed)?/i;
const SKIP =
  /\botp\b|one time password|verification code|avl\.? bal.*only|requested money|collect request|will be debited|due on|statement is ready|offer|cashback up to/i;
/** Where the money went, in the phrasings Indian banks use. */
const PAYEE = [
  /\b(?:to|at|towards)\s+(?:vpa\s+)?([\w@.&' -]+?)(?=\s+(?:on|ref|upi|via|from|avl|info|txn|for)\b|[.(]|$)/i,
  /;\s*([\w&' .-]+?)\s+credited/i,
  /info[:\s]+([\w@.&' /-]+?)(?=[.(]|\s+avl|$)/i,
];

/** Splits pasted messages: one per blank line, or one per line when there are no blank lines. */
export function splitMessages(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Reads pasted bank SMS alerts. Returns parsed rows and how many messages weren't transactions. */
export function parseSms(text: string, today = new Date()): { rows: RawRow[]; skipped: number } {
  const rows: RawRow[] = [];
  let skipped = 0;
  for (const msg of splitMessages(text)) {
    const amountMatch = msg.match(AMOUNT);
    const isCredit = CREDIT.test(msg) && !DEBIT.test(msg.split(CREDIT)[0] ?? "");
    const isDebit = DEBIT.test(msg);
    if (SKIP.test(msg) || !amountMatch || (!isDebit && !isCredit)) {
      skipped++;
      continue;
    }
    const amount = parseAmount(amountMatch[1]!);
    if (!amount) {
      skipped++;
      continue;
    }
    const dateText = msg.match(DATE)?.[1];
    const date = (dateText && parseDate(dateText)) || today.toISOString();
    const payee = PAYEE.map((re) => msg.match(re)?.[1]?.trim()).find(
      (p) => p && /[a-z]{2,}/i.test(p),
    );
    rows.push({
      date,
      description: payee ?? msg.slice(0, 60),
      amount,
      direction: isCredit && !isDebit ? "credit" : "debit",
      ...(AUTOPAY.test(msg) && { autopay: true }),
    });
  }
  return { rows, skipped };
}
