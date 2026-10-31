import { parseAmount, parseDate, type RawRow } from "./rows";

export class PdfPasswordError extends Error {}

/** Pulls the text out of a PDF, one string per visual line, in reading order. */
async function pdfLines(data: ArrayBuffer, password?: string): Promise<string[]> {
  // Loaded on demand: pdf.js is large and only needed when someone imports a PDF.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, password }).promise;
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException") throw new PdfPasswordError();
    throw e;
  }
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3; // items on one row differ by a point or two
      byY.set(y, [...(byY.get(y) ?? []), { x: item.transform[4], s: item.str }]);
    }
    [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) =>
        lines.push(
          items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.s)
            .join(" "),
        ),
      );
  }
  return lines;
}

const LEADING_DATE =
  /^\s*(\d{1,2}[/.-](?:\d{1,2}|[a-z]{3})[/.-]\d{2,4}|\d{1,2}\s[a-z]{3}\s\d{2,4})\s+(.*)$/i;
const MONEY = /-?\(?[\d,]+\.\d{2}\)?(?:\s*(?:cr|dr))?/gi;

/** Page furniture that repeats on every page and must not be glued onto a narration. */
const FURNITURE =
  /page \d|statement of|narration|withdrawal|deposit amt|closing balance|generated on/i;
const OPENING = /opening balance|balance b\/?f|brought forward/i;

/**
 * Reads statement lines shaped like "Date  Narration … Amount  Balance". Everything up to the
 * next dated line belongs to the same row, so narration or amounts that wrap are joined back.
 * Whether a row is a debit or a credit comes from the running balance going down or up, so it
 * works without knowing each bank's column layout.
 */
export function parseStatementLines(lines: string[]): RawRow[] {
  const blocks: { date: string; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(LEADING_DATE);
    const iso = m ? parseDate(m[1]!) : null;
    if (m && iso) blocks.push({ date: iso, text: m[2]! });
    else if (blocks.length && !FURNITURE.test(line)) blocks.at(-1)!.text += ` ${line.trim()}`;
  }

  const rows: (RawRow & { balance: number | null; marker: string | null })[] = [];
  let opening: number | null = null;
  for (const { date, text } of blocks) {
    const money = [...text.matchAll(MONEY)].map((x) => x[0]);
    if (money.length === 0) continue;
    const marker =
      money
        .at(-1)!
        .match(/(cr|dr)\s*$/i)?.[1]
        ?.toLowerCase() ?? null;
    const values = money
      .map((v) => parseAmount(v.replace(/\s*(cr|dr)$/i, "")))
      .filter((v): v is number => v !== null);
    const description = text
      .replace(MONEY, " ")
      .replace(/\b\d{1,2}[/.-](\d{1,2}|[a-z]{3})[/.-]\d{2,4}\b/gi, "") // value-date column
      .replace(/\b\d{10,}\b/g, "") // cheque / reference numbers
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    if (OPENING.test(description)) {
      opening = values.at(-1)!;
      continue;
    }
    rows.push({
      date,
      description,
      amount: Math.abs(values.length >= 2 ? values.at(-2)! : values[0]!),
      direction: "debit",
      balance: values.length >= 2 ? values.at(-1)! : null,
      marker,
    });
  }

  return rows.map((r, i) => {
    const prev = i === 0 ? opening : rows[i - 1]!.balance;
    let direction: RawRow["direction"] = "debit";
    if (prev != null && r.balance != null && Math.abs(Math.abs(r.balance - prev) - r.amount) < 1) {
      direction = r.balance > prev ? "credit" : "debit";
    } else if (r.marker === "cr" && r.balance === null) {
      // A trailing "Cr" on a lone amount marks a credit; on a balance column it doesn't.
      direction = "credit";
    } else if (
      /salary|refund|reversal|interest credit|neft cr|imps cr|by transfer/i.test(r.description)
    ) {
      direction = "credit";
    }
    return { date: r.date, description: r.description, amount: r.amount, direction };
  });
}

export async function parsePdf(data: ArrayBuffer, password?: string): Promise<RawRow[]> {
  const rows = parseStatementLines(await pdfLines(data, password));
  if (rows.length === 0) {
    throw new Error(
      "Couldn't find any transactions in this PDF. If it's a scanned image, download a fresh statement from net banking or use the CSV export.",
    );
  }
  return rows;
}
