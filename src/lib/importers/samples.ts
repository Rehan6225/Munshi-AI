import { demoTransactions, SAMPLE_INCOME } from "../store";

/**
 * Sample files for people who want to try importing without their own statement.
 * They hold the demo's own spending, written the way a bank prints it, so importing one
 * gives the same bills, subscriptions, trends and nudges as the demo. Built fresh from
 * today's date, so the month always looks current.
 */

interface SampleRow {
  date: Date;
  narration: string;
  debit?: number;
  credit?: number;
}

const DAY = 86400000;

/** How the bank prints each demo merchant. Rent, EMI, insurance and SIP go by mandate. */
const NARRATION: Record<string, string> = {
  Swiggy: "UPI-SWIGGY-swiggy@icici",
  Zomato: "UPI-ZOMATO-zomato@hdfcbank",
  Blinkit: "UPI-BLINKIT-blinkit@hdfcbank",
  Uber: "UPI-UBER INDIA-uber@axisbank",
  "Third Wave Coffee": "UPI-THIRD WAVE COFFEE-twc@okaxis",
  "Apollo Pharmacy": "POS 4581XXXX9014 APOLLO PHARMACY HSR",
  Myntra: "UPI-MYNTRA-myntra@icici",
  Amazon: "ECOM-AMAZON PAY INDIA-AMZN0981",
  "Social, Indiranagar": "UPI-SOCIAL RESTAURANT INDIRANAGAR-social@ybl",
  "Looks Salon": "UPI-LOOKS SALON-looks.salon@okicici",
  Petrol: "POS 4581XXXX9014 INDIAN OIL COCO BLR",
  DMart: "POS 4581XXXX9014 DMART HSR LAYOUT",
  Toit: "UPI-TOIT BREWPUB RESTAURANT-toit@ybl",
  Truffles: "UPI-TRUFFLES CAFE-truffles@okicici",
  "Sent to Mom": "UPI-SENT TO MOM-anita.sharma@okhdfcbank",
  Netflix: "NETFLIX.COM SI-MANDATE",
  "Disney+ Hotstar": "DISNEY HOTSTAR SI-MANDATE",
  Spotify: "SPOTIFY INDIA SI-MANDATE",
  "Cult.fit": "UPI-CULTFIT-cultfit@hdfcbank-AUTOPAY",
  "YouTube Premium": "YOUTUBE PREMIUM SI-MANDATE",
  "Amazon Prime": "AMAZON PRIME SI-MANDATE",
  "House rent": "ACH D-HOUSE RENT-SI MANDATE",
  "Airtel broadband": "ACH D-AIRTEL BROADBAND-NACH",
  "BESCOM electricity": "BBPS/BESCOM/0042718831",
  "Bike EMI": "ACH D-BIKE EMI BAJAJ FIN-NACH",
  "Star Health insurance": "ACH D-STAR HEALTH INSURANCE-NACH",
  "Maid (Sunita)": "UPI-SUNITA MAID-sunita.devi@ybl",
  "Laundry & ironing": "UPI-LAUNDRY RAJU-raju.dhobi@ybl",
  "Groww SIP": "ACH D-GROWW SIP-NACH",
};
export const narrationFor = (merchant: string) =>
  NARRATION[merchant] ?? `UPI-${merchant.toUpperCase()}-payee@ybl`;

/** The demo's transactions from the last 9 months (enough to catch the yearly Prime renewal), plus salary credits. */
function sampleRows(now: Date): SampleRow[] {
  const from = now.getTime() - 270 * DAY;
  const spends: SampleRow[] = demoTransactions(now)
    .filter((t) => new Date(t.date).getTime() >= from)
    .map((t) => ({ date: new Date(t.date), narration: narrationFor(t.merchant), debit: t.amount }));
  const first = Math.min(...spends.map((r) => r.date.getTime()));
  const salaries: SampleRow[] = [];
  for (let m = 0; m < 10; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 10);
    if (date.getTime() > now.getTime() || date.getTime() < first) continue;
    salaries.push({
      date,
      narration: "NEFT CR-ACME TECHNOLOGIES PVT LTD-SALARY",
      credit: SAMPLE_INCOME,
    });
  }
  // A refund, as real statements have: it's a credit, so the import leaves it out.
  const myntra = spends.find((r) => r.narration === NARRATION["Myntra"]);
  const refund: SampleRow[] = myntra
    ? [
        {
          date: new Date(myntra.date.getTime() + 2 * DAY),
          narration: "UPI-MYNTRA REFUND-myntra@icici",
          credit: 899,
        },
      ].filter((r) => r.date.getTime() <= now.getTime())
    : [];
  return [...spends, ...salaries, ...refund].sort((a, b) => a.date.getTime() - b.date.getTime());
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
export async function samplePdf(now = new Date()): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const rows = statement(now);
  const col = (s: string, w: number, right = false) =>
    (right ? s.padStart(w) : s.padEnd(w)).slice(0, w);
  const header =
    col("Date", 10) +
    col("Narration", 40) +
    col("Chq./Ref.No.", 16) +
    col("Value Dt", 10) +
    col("Withdrawal Amt.", 16, true) +
    col("Deposit Amt.", 14, true) +
    col("Closing Balance", 17, true);
  const line = (r: (typeof rows)[number]) =>
    col(ddmmyy(r.date), 10) +
    col(r.narration, 40) +
    col(r.ref, 16) +
    col(ddmmyy(r.date), 10) +
    col(r.debit ? money(r.debit) : "", 16, true) +
    col(r.credit ? money(r.credit) : "", 14, true) +
    col(money(r.balance), 17, true);

  const PER_PAGE = 24;
  const pages = Array.from({ length: Math.ceil(rows.length / PER_PAGE) }, (_, i) =>
    rows.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
  );
  pages.forEach((pageRows, p) => {
    if (p > 0) doc.addPage();
    doc.setFont("helvetica", "bold").setFontSize(14).text("HDFC BANK LTD", 40, 48);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text("SAMPLE STATEMENT FOR TRYING MUNSHI AI. NOT A REAL ACCOUNT.", 40, 64);
    doc.text(
      `Account No : XXXXXXXX4421   Statement From : ${ddmmyy(rows[0]!.date)} To : ${ddmmyy(rows.at(-1)!.date)}`,
      40,
      78,
    );
    doc.setTextColor(0).setFont("courier", "bold").setFontSize(8.5);
    doc.text(header, 40, 108);
    doc.setDrawColor(180).line(40, 114, 800, 114);
    doc.setFont("courier", "normal");
    let y = 130;
    if (p === 0) {
      doc.text(
        col(ddmmyy(new Date(rows[0]!.date.getTime() - DAY)), 10) +
          col("OPENING BALANCE", 92) +
          col(money(OPENING), 21, true),
        40,
        y,
      );
      y += 16;
    }
    for (const r of pageRows) {
      doc.text(line(r), 40, y);
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
