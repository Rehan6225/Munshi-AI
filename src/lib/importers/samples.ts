import { SAMPLE_INCOME } from "../store";

/**
 * Sample files for people who want to try importing without their own statement.
 * Three months of the demo's money, written the way a bank prints it: every fixed cost
 * (rent, bike EMI, maid, electricity, laundry, insurance, broadband), the SIP, the
 * subscriptions and everyday spends, so importing one brings up the demo's bills and
 * nudges. Built fresh from today's date, so the month always looks current.
 */

interface SampleRow {
  date: Date;
  narration: string;
  debit?: number;
  credit?: number;
}

const DAY = 86400000;

/** Bills, the SIP and subscriptions: [narration, amounts oldest first, days since the latest]. */
const MONTHLY: [string, number[], number][] = [
  ["ACH D-HOUSE RENT-SI MANDATE", [22000, 22000, 22000], 4],
  ["ACH D-BIKE EMI BAJAJ FIN-NACH", [3200, 3200, 3200], 5],
  ["UPI-SUNITA MAID-sunita.devi@ybl", [3000, 3000, 3000], 1],
  ["BBPS/BESCOM/0042718831", [1550, 1390, 1450], 7],
  ["UPI-LAUNDRY RAJU-raju.dhobi@ybl", [600, 600, 600], 8],
  ["ACH D-STAR HEALTH INSURANCE-NACH", [1250, 1250, 1250], 15],
  ["ACH D-AIRTEL BROADBAND-NACH", [999, 999, 999], 9],
  ["ACH D-GROWW SIP-NACH", [10000, 10000, 10000], 5],
  // Netflix went up last month; YouTube Premium is a new sign-up.
  ["NETFLIX.COM SI-MANDATE", [499, 649, 649], 12],
  ["DISNEY HOTSTAR SI-MANDATE", [299, 299, 299], 12],
  ["SPOTIFY INDIA SI-MANDATE", [119, 119, 119], 11],
  ["UPI-CULTFIT-cultfit@hdfcbank-AUTOPAY", [1299, 1299, 1299], 13],
  ["YOUTUBE PREMIUM SI-MANDATE", [149, 149], 3],
  ["AMAZON PRIME SI-MANDATE", [1499], 80],
];

/**
 * Everyday spends: [narration, amount, days ago]. Eating out is well above the two months
 * before, and Shopping is past the demo's budget. Meghana Foods is a local place the bank
 * text only hints at, so those rows need a look, and one is filed apart from the rest.
 */
const SPENDS: [string, number, number][] = [
  // This month
  ["UPI-SWIGGY-swiggy@icici", 640, 0],
  ["UPI-ZOMATO-zomato@hdfcbank", 520, 1],
  ["UPI-BLINKIT-blinkit@hdfcbank", 1240, 1],
  ["UPI-UBER INDIA-uber@axisbank", 320, 2],
  ["UPI-THIRD WAVE COFFEE-twc@okaxis", 410, 3],
  ["POS 4581XXXX9014 APOLLO PHARMACY HSR", 860, 4],
  ["UPI-TRUFFLES CAFE-truffles@okicici", 980, 6],
  ["UPI-MYNTRA-myntra@icici", 2899, 7],
  ["UPI-SOCIAL RESTAURANT INDIRANAGAR-social@ybl", 2350, 8],
  ["UPI-LOOKS SALON-looks.salon@okicici", 700, 9],
  ["POS 4581XXXX9014 INDIAN OIL COCO BLR", 2500, 10],
  ["UPI-TOIT BREWPUB RESTAURANT-toit@ybl", 1450, 11],
  ["POS 4581XXXX9014 DMART HSR LAYOUT", 3150, 14],
  ["UPI-MEGHANA FOODS-meghana@ybl-BIRYANI ORDER", 560, 16],
  ["UPI-SENT TO MOM-anita.sharma@okhdfcbank", 5000, 18],
  // Last month
  ["UPI-SWIGGY-swiggy@icici", 1800, 36],
  ["UPI-MEGHANA FOODS-meghana@ybl-BIRYANI ORDER", 1300, 39],
  ["POS 4581XXXX9014 DMART HSR LAYOUT", 3300, 50],
  ["UPI-ZOMATO-zomato@hdfcbank", 1400, 45],
  ["POS 4581XXXX9014 INDIAN OIL COCO BLR", 2100, 47],
  ["UPI-MEGHANA FOODS-meghana@ybl", 420, 50],
  ["UPI-BLINKIT-blinkit@hdfcbank", 2200, 52],
  ["ECOM-AMAZON PAY INDIA-AMZN0981", 2200, 55],
  // The month before
  ["UPI-SWIGGY-swiggy@icici", 2100, 66],
  ["POS 4581XXXX9014 DMART HSR LAYOUT", 3200, 70],
  ["UPI-MEGHANA FOODS-meghana@ybl-BIRYANI ORDER", 1900, 74],
  ["UPI-BLINKIT-blinkit@hdfcbank", 2000, 78],
  ["POS 4581XXXX9014 INDIAN OIL COCO BLR", 2200, 82],
  ["UPI-MYNTRA-myntra@icici", 1500, 85],
];

/** Every spend plus a salary credit each month and a refund, oldest first. */
function sampleRows(now: Date): SampleRow[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const rows: SampleRow[] = [
    ...MONTHLY.flatMap(([narration, amounts, latest]) =>
      amounts.map((debit, i) => ({
        date: ago(latest + (amounts.length - 1 - i) * 30),
        narration,
        debit,
      })),
    ),
    ...SPENDS.map(([narration, debit, days]) => ({ date: ago(days), narration, debit })),
    // A refund, as real statements have: it's a credit, so the import leaves it out.
    { date: ago(5), narration: "UPI-MYNTRA REFUND-myntra@icici", credit: 899 },
  ];
  const first = Math.min(...rows.map((r) => r.date.getTime()));
  for (let m = 0; m < 4; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 10);
    if (date.getTime() <= now.getTime() && date.getTime() >= first)
      rows.push({
        date,
        narration: "NEFT CR-ACME TECHNOLOGIES PVT LTD-SALARY",
        credit: SAMPLE_INCOME,
      });
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const OPENING = 48250;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const day = (now: Date, daysAgo: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
const pad = (n: number) => String(n).padStart(2, "0");
/** 24/10/26 */
const ddmmyy = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
/** 24-10-26 */
const ddmmyyDash = (d: Date) => ddmmyy(d).replace(/\//g, "-");
/** 24-Oct-26 */
const ddMonyy = (d: Date) =>
  `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
/** 1,23,456.78 */
const money = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rows with a reference number and a running balance, oldest first. */
function statement(now: Date) {
  let balance = OPENING;
  return sampleRows(now).map((r, i) => {
    balance += (r.credit ?? 0) - (r.debit ?? 0);
    return { ...r, ref: `00004298${12300 + i * 7}`, balance };
  });
}

export function sampleCsv(now = new Date()): string {
  const rows = statement(now);
  const span = `Statement From : ${ddmmyy(rows[0]!.date)} To : ${ddmmyy(rows.at(-1)!.date)}`;
  const q = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    "HDFC BANK LTD - SAMPLE STATEMENT (not a real account),,,,,,",
    "Account No : XXXXXXXX4421,,,,,,",
    `${span},,,,,,`,
    ",,,,,,",
    "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
    ...rows.map((r) =>
      [
        ddmmyy(r.date),
        q(r.narration),
        r.ref,
        ddmmyy(r.date),
        r.debit ? q(money(r.debit)) : "",
        r.credit ? q(money(r.credit)) : "",
        q(money(r.balance)),
      ].join(","),
    ),
  ].join("\n");
}

export function sampleSms(now = new Date()): string {
  const d = (n: number) => ddmmyyDash(day(now, n));
  return [
    `Your A/c XX4421 is debited with Rs.22,000.00 on ${d(30)} by ACH towards HOUSE RENT. Avl Bal Rs.26,250.00 -HDFC Bank`,
    `Rs.649.00 debited from A/c XX4421 on ${d(27)} towards NETFLIX via e-mandate (SI). Not you? Call 18002586161 -HDFC Bank`,
    `Rs.${money(SAMPLE_INCOME)} credited to A/c XX4421 on ${d(25)} by NEFT from ACME TECHNOLOGIES. Avl Bal Rs.1,43,445.00 -HDFC Bank`,
    `Rs.3,200.00 debited from A/c XX4421 on ${d(24)} towards BIKE EMI BAJAJ FIN via NACH. -HDFC Bank`,
    `Rs.1,499.00 debited from A/c XX4421 on ${d(24)} towards AMAZON PRIME via e-mandate (SI). -HDFC Bank`,
    `Rs.1,450.00 debited from A/c XX4421 on ${d(22)} towards BESCOM ELECTRICITY via BBPS. -HDFC Bank`,
    `Rs.119.00 debited from A/c XX4421 on ${d(21)} towards SPOTIFY via e-mandate (SI). -HDFC Bank`,
    `Sent Rs.1,500.00 from Kotak Bank AC X8812 to ramesh.kumar@ybl on ${d(20)}. UPI Ref 4291XXXX`,
    `INR 2,500.00 spent on ICICI Card XX9014 on ${ddMonyy(day(now, 19))} at IOCL COCO BLR. Avl Lmt: INR 84,210`,
    `Rs.999.00 debited from A/c XX4421 on ${d(18)} towards AIRTEL BROADBAND via autopay. -HDFC Bank`,
    `Your OTP for login is 482911. Do not share it with anyone.`,
    `Rs.299.00 debited from A/c XX4421 on ${d(13)} towards DISNEY HOTSTAR via e-mandate (SI). -HDFC Bank`,
    `INR 8,990.00 spent on ICICI Card XX9014 on ${ddMonyy(day(now, 10))} at CROMA INDIRANAGAR. Avl Lmt: INR 75,220`,
    `Rs.1,299.00 debited from A/c XX4421 on ${d(9)} towards CULTFIT via autopay. -HDFC Bank`,
    `Rs.932.00 debited from A/c XX4421 on ${d(5)} to VPA swiggy@icici (UPI Ref 4298XXXX). Not you? Call 18002586161 -HDFC Bank`,
    `Rs.690.00 debited from A/c XX4421 on ${d(1)} to VPA zomato@hdfcbank (UPI Ref 4299XXXX). -HDFC Bank`,
    `Rs.3,000.00 debited from A/c XX4421 on ${d(1)} to SUNITA MAID via UPI (Ref 4300XXXX). -HDFC Bank`,
  ].join("\n\n");
}

/** A statement PDF laid out like a net-banking download. */
/** A fixed-width column that always leaves a space before the next one. */
const col = (s: string, w: number, right = false) =>
  right ? s.slice(0, w - 1).padStart(w) : s.slice(0, w - 1).padEnd(w);

/** The statement as the PDF prints it, one string per line: the header row, then one per transaction. */
export function sampleStatementLines(now = new Date()) {
  const rows = statement(now);
  const header =
    col("Date", 10) +
    col("Narration", 46) +
    col("Chq./Ref.No.", 16) +
    col("Value Dt", 10) +
    col("Withdrawal Amt.", 16, true) +
    col("Deposit Amt.", 14, true) +
    col("Closing Balance", 17, true);
  const opening =
    col(ddmmyy(new Date(rows[0]!.date.getTime() - DAY)), 10) +
    col("OPENING BALANCE", 102) +
    col(money(OPENING), 17, true);
  const lines = rows.map(
    (r) =>
      col(ddmmyy(r.date), 10) +
      col(r.narration, 46) +
      col(r.ref, 16) +
      col(ddmmyy(r.date), 10) +
      col(r.debit ? money(r.debit) : "", 16, true) +
      col(r.credit ? money(r.credit) : "", 14, true) +
      col(money(r.balance), 17, true),
  );
  return { header, opening, lines, from: rows[0]!.date, to: rows.at(-1)!.date };
}

/** A statement PDF laid out like a net-banking download. */
export async function samplePdf(now = new Date()): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const { header, opening, lines, from, to } = sampleStatementLines(now);

  const PER_PAGE = 24;
  const pages = Array.from({ length: Math.ceil(lines.length / PER_PAGE) }, (_, i) =>
    lines.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
  );
  pages.forEach((pageLines, p) => {
    if (p > 0) doc.addPage();
    doc.setFont("helvetica", "bold").setFontSize(14).text("HDFC BANK LTD", 40, 48);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text("SAMPLE STATEMENT FOR TRYING MUNSHI AI. NOT A REAL ACCOUNT.", 40, 64);
    doc.text(
      `Account No : XXXXXXXX4421   Statement From : ${ddmmyy(from)} To : ${ddmmyy(to)}`,
      40,
      78,
    );
    doc.setTextColor(0).setFont("courier", "bold").setFontSize(8.5);
    doc.text(header, 40, 108);
    doc.setDrawColor(180).line(40, 114, 800, 114);
    doc.setFont("courier", "normal");
    let y = 130;
    if (p === 0) {
      doc.text(opening, 40, y);
      y += 16;
    }
    for (const line of pageLines) {
      doc.text(line, 40, y);
      y += 16;
    }
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
    doc.text(`Page ${p + 1} of ${pages.length}`, 40, 570);
    doc.setTextColor(0);
  });
  return doc.output("arraybuffer");
}

/** Starts a browser download of a file the page generated. */
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
