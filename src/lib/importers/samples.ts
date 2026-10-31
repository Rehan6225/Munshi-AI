/**
 * Sample files for people who want to try importing without their own statement.
 * Built fresh from today's date, so the month always looks current, and full of
 * subscriptions and bills so the automatic subscription detection has something to find.
 */

interface SampleRow {
  daysAgo: number;
  narration: string;
  debit?: number;
  credit?: number;
}

const ROWS: SampleRow[] = [
  { daysAgo: 30, narration: "ACH D-HOUSE RENT-SI MANDATE", debit: 22000 },
  { daysAgo: 29, narration: "UPI-SWIGGY-swiggy@icici", debit: 486 },
  { daysAgo: 28, narration: "POS 4581XXXX9014 DMART HSR LAYOUT", debit: 3150 },
  { daysAgo: 27, narration: "NETFLIX.COM SI-MANDATE", debit: 649 },
  { daysAgo: 26, narration: "UPI-ZOMATO-zomato@hdfcbank", debit: 520 },
  { daysAgo: 25, narration: "NEFT CR-ACME TECHNOLOGIES PVT LTD-SALARY", credit: 95000 },
  { daysAgo: 25, narration: "UPI-UBER INDIA-uber@axisbank", debit: 320 },
  { daysAgo: 24, narration: "AMAZON PRIME SI-MANDATE", debit: 1499 },
  { daysAgo: 23, narration: "UPI-BLINKIT-blinkit@hdfcbank", debit: 1240 },
  { daysAgo: 22, narration: "BBPS/BESCOM/0042718831", debit: 1312 },
  { daysAgo: 21, narration: "SPOTIFY INDIA SI-MANDATE", debit: 119 },
  { daysAgo: 20, narration: "UPI-RAMESH KUMAR-ramesh.kumar@ybl", debit: 1500 },
  { daysAgo: 19, narration: "POS 4581XXXX9014 INDIAN OIL COCO BLR", debit: 2500 },
  { daysAgo: 18, narration: "ACH D-AIRTEL BROADBAND-NACH", debit: 999 },
  { daysAgo: 17, narration: "UPI-THIRD WAVE COFFEE-twc@okaxis", debit: 410 },
  { daysAgo: 16, narration: "YOUTUBE PREMIUM SI-MANDATE", debit: 149 },
  { daysAgo: 15, narration: "ECOM-AMAZON PAY INDIA-AMZN0981", debit: 1899 },
  { daysAgo: 14, narration: "UPI-ZEPTO-zepto@ybl", debit: 684 },
  { daysAgo: 13, narration: "DISNEY HOTSTAR SI-MANDATE", debit: 299 },
  { daysAgo: 12, narration: "UPI-MYNTRA-myntra@icici", debit: 2899 },
  { daysAgo: 11, narration: "UPI-MYNTRA REFUND-myntra@icici", credit: 899 },
  { daysAgo: 10, narration: "POS 4581XXXX9014 CROMA INDIRANAGAR", debit: 8990 },
  { daysAgo: 9, narration: "UPI-CULTFIT-cultfit@hdfcbank-AUTOPAY", debit: 1299 },
  { daysAgo: 8, narration: "UPI-RAPIDO-rapido@ybl", debit: 146 },
  { daysAgo: 7, narration: "UPI-BOOKMYSHOW-bms@icici", debit: 760 },
  { daysAgo: 6, narration: "ATW-ATM CASH WDL-HSR LAYOUT", debit: 5000 },
  { daysAgo: 5, narration: "UPI-SWIGGY INSTAMART-swiggy@icici", debit: 932 },
  { daysAgo: 4, narration: "UPI-SOCIAL INDIRANAGAR-social@ybl", debit: 2350 },
  { daysAgo: 3, narration: "UPI-IRCTC-irctc@sbi", debit: 2140 },
  { daysAgo: 2, narration: "UPI-PRIYA S-priya.s@okhdfcbank", debit: 800 },
  { daysAgo: 1, narration: "UPI-ZOMATO-zomato@hdfcbank", debit: 690 },
];

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

/** Rows with dates and a running balance, oldest first. */
function statement(now: Date) {
  let balance = OPENING;
  return ROWS.map((r, i) => {
    balance += (r.credit ?? 0) - (r.debit ?? 0);
    return { ...r, date: day(now, r.daysAgo), ref: `00004298${12300 + i * 7}`, balance };
  });
}

export function sampleCsv(now = new Date()): string {
  const rows = statement(now);
  const q = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    "HDFC BANK LTD - SAMPLE STATEMENT (not a real account),,,,,,",
    "Account No : XXXXXXXX4421,,,,,,",
    `Statement From : ${ddmmyy(day(now, 30))} To : ${ddmmyy(day(now, 1))},,,,,,`,
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
    `Rs.95,000.00 credited to A/c XX4421 on ${d(25)} by NEFT from ACME TECHNOLOGIES. Avl Bal Rs.1,18,445.00 -HDFC Bank`,
    `Rs.1,499.00 debited from A/c XX4421 on ${d(24)} towards AMAZON PRIME via e-mandate (SI). -HDFC Bank`,
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
  ].join("\n\n");
}

/** A two-page statement PDF laid out like a net-banking download. */
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

  const pages = [rows.slice(0, 18), rows.slice(18)];
  pages.forEach((pageRows, p) => {
    if (p > 0) doc.addPage();
    doc.setFont("helvetica", "bold").setFontSize(14).text("HDFC BANK LTD", 40, 48);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text("SAMPLE STATEMENT FOR TRYING MUNSHI AI. NOT A REAL ACCOUNT.", 40, 64);
    doc.text(
      `Account No : XXXXXXXX4421   Statement From : ${ddmmyy(day(now, 30))} To : ${ddmmyy(day(now, 1))}`,
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
        col(ddmmyy(day(now, 31)), 10) + col("OPENING BALANCE", 92) + col(money(OPENING), 21, true),
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
