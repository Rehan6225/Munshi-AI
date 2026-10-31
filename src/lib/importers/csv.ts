import { parseAmount, parseDate, type RawRow } from "./rows";

/** Splits CSV text into cells, honouring quoted fields with commas and newlines. */
export function splitCsv(text: string): string[][] {
  const delimiter = (text.split("\n")[0] ?? "").includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const find = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h));

/**
 * Reads a bank or app CSV export. Bank files often start with a few lines of account
 * details, so the header is the first row that names a date and a description column.
 */
export function parseCsv(text: string): RawRow[] {
  const rows = splitCsv(text);
  const headerAt = rows.findIndex(
    (r) =>
      r.some((c) => /date/i.test(c)) &&
      r.some((c) => /narration|description|particulars|details|remarks|merchant|payee/i.test(c)),
  );
  if (headerAt < 0)
    throw new Error(
      "Couldn't find the column headers. The file needs a Date and a Description (or Narration) column.",
    );
  const header = rows[headerAt]!.map((h) => h.toLowerCase());

  const date = find(header, /^(txn |transaction |value )?date|date$/);
  const desc = find(header, /narration|description|particulars|details|remarks|merchant|payee/);
  const debit = find(header, /withdrawal|debit|dr\.?( amount)?$|paid out|money out/);
  const credit = find(header, /deposit|credit|cr\.?( amount)?$|paid in|money in/);
  const amount = find(header, /^amount|amount( \(inr\)| \(₹\)| \(rs\.?\))?$/);
  const type = find(header, /^(type|dr\/cr|cr\/dr|debit\/credit|txn type)$/);
  if (debit < 0 && amount < 0)
    throw new Error("Couldn't find an amount column. Look for Withdrawal, Debit or Amount.");

  const body = rows.slice(headerAt + 1);
  // With a single signed Amount column, negatives are spending and positives money coming in.
  const signed = amount >= 0 && body.some((r) => (parseAmount(r[amount] ?? "") ?? 0) < 0);

  const out: RawRow[] = [];
  for (const r of body) {
    const iso = parseDate(r[date] ?? "");
    if (!iso) continue; // totals, footers, blank lines
    const description = (r[desc] ?? "").trim();
    if (debit >= 0) {
      const dr = parseAmount(r[debit] ?? "");
      const cr = credit >= 0 ? parseAmount(r[credit] ?? "") : null;
      if (dr) out.push({ date: iso, description, amount: Math.abs(dr), direction: "debit" });
      else if (cr) out.push({ date: iso, description, amount: Math.abs(cr), direction: "credit" });
    } else {
      const value = parseAmount(r[amount] ?? "");
      if (!value) continue;
      const isCredit =
        type >= 0
          ? /^c|credit|deposit|received/.test((r[type] ?? "").toLowerCase())
          : signed
            ? value > 0
            : /refund|salary|received|cashback/i.test(description);
      out.push({
        date: iso,
        description,
        amount: Math.abs(value),
        direction: isCredit ? "credit" : "debit",
      });
    }
  }
  return out;
}
