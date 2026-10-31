import { describe, expect, it } from "vitest";
import { categorize, cleanMerchant } from "./categorize";
import { parseCsv } from "./csv";
import { parseStatementLines } from "./pdf";
import { parseDate, toDrafts } from "./rows";
import { parseSms } from "./sms";

describe("parseDate", () => {
  it("reads the date formats Indian banks use", () => {
    const oct24 = "2026-10-24T12:00:00.000Z";
    expect(parseDate("24/10/2026")).toBe(oct24);
    expect(parseDate("24-10-26")).toBe(oct24);
    expect(parseDate("24-Oct-2026")).toBe(oct24);
    expect(parseDate("24 Oct 26")).toBe(oct24);
    expect(parseDate("2026-10-24")).toBe(oct24);
    expect(parseDate("Opening balance")).toBeNull();
  });
});

describe("cleanMerchant and categorize", () => {
  it("turns UPI and card narrations into a merchant name", () => {
    expect(cleanMerchant("UPI-SWIGGY-swiggy@icici-ICIC0DC0099-429812345678")).toBe("Swiggy");
    expect(cleanMerchant("POS 4581XXXX9014 CROMA INDIRANAGAR")).toBe("Croma Indiranagar");
    expect(cleanMerchant("swiggy@icici")).toBe("Swiggy");
    expect(cleanMerchant("ACH D-HOUSE RENT-SI MANDATE")).toBe("House Rent");
    expect(cleanMerchant("NETFLIX.COM SI-MANDATE")).toBe("Netflix");
    expect(cleanMerchant("POS 4581XXXX9014 INDIAN OIL COCO BLR")).toBe("Indian Oil Coco BLR");
    expect(cleanMerchant("ATW-ATM CASH WDL-HSR LAYOUT")).toBe("ATM cash withdrawal");
  });

  it("uses the user's own rule before the known list", () => {
    expect(categorize("Swiggy", "")).toEqual({ category: "Food & Dining", confidence: "high" });
    expect(
      categorize("Swiggy", "", [
        {
          id: "r1",
          key: "swiggy",
          merchant: "Swiggy",
          category: "Groceries",
          applied: 0,
          createdAt: "",
        },
      ]),
    ).toEqual({
      category: "Groceries",
      confidence: "high",
      remembered: true,
    });
    expect(categorize("Swiggy Instamart", "").category).toBe("Groceries");
    // Bills keywords match whole words: "premium" isn't an EMI, "current" isn't rent.
    expect(categorize("Youtube Premium", "").category).toBe("Subscriptions");
    expect(categorize("Current Account Charges", "").category).toBe("Other");
    expect(categorize("House Rent", "").category).toBe("Rent & Housing");
    expect(categorize("Ramesh Kumar", "UPI-RAMESH KUMAR-9845@ybl")).toEqual({
      category: "Other",
      confidence: "low",
    });
  });
});

describe("parseCsv", () => {
  it("skips the account preamble and reads separate debit and credit columns", () => {
    const csv = [
      "Account Statement,,,,,,",
      "Account No: XXXX4421,,,,,,",
      "",
      "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
      '24/10/26,UPI-SWIGGY-swiggy@icici-ICIC0DC0099,0000429812345,24/10/26,486.00,,"12,345.67"',
      '25/10/26,NEFT CR-ACME PVT LTD-SALARY,0000429812346,25/10/26,,"95,000.00","1,07,345.67"',
      "Total,,,,486.00,95000.00,",
    ].join("\n");
    expect(parseCsv(csv)).toEqual([
      {
        date: "2026-10-24T12:00:00.000Z",
        description: "UPI-SWIGGY-swiggy@icici-ICIC0DC0099",
        amount: 486,
        direction: "debit",
      },
      {
        date: "2026-10-25T12:00:00.000Z",
        description: "NEFT CR-ACME PVT LTD-SALARY",
        amount: 95000,
        direction: "credit",
      },
    ]);
  });

  it("treats negatives as spending when there is a single signed amount column", () => {
    const rows = parseCsv(
      "Date,Description,Amount\n2026-10-20,Uber trip,-320\n2026-10-21,Refund from Myntra,899",
    );
    expect(rows.map((r) => r.direction)).toEqual(["debit", "credit"]);
  });

  it("explains what is missing when the file has no usable header", () => {
    expect(() => parseCsv("a,b,c\n1,2,3")).toThrow(/Date and a Description/);
  });
});

describe("parseSms", () => {
  it("reads debit alerts and skips OTPs", () => {
    const text = [
      "Rs.486.00 debited from A/c XX4421 on 24-10-26 to VPA swiggy@icici (UPI Ref 4298XXXX). Not you? Call 18002586161 -HDFC Bank",
      "Your OTP for login is 482911. Do not share.",
      "INR 2,000.00 spent on ICICI Card XX9014 on 22-Oct-26 at IOCL COCO BLR. Avl Lmt: INR 84,210",
    ].join("\n\n");
    const { rows, skipped } = parseSms(text);
    expect(skipped).toBe(1);
    expect(rows).toEqual([
      {
        date: "2026-10-24T12:00:00.000Z",
        description: "swiggy@icici",
        amount: 486,
        direction: "debit",
      },
      {
        date: "2026-10-22T12:00:00.000Z",
        description: "IOCL COCO BLR",
        amount: 2000,
        direction: "debit",
      },
    ]);
  });
});

describe("parseStatementLines", () => {
  it("reads direction from the running balance and joins wrapped narration", () => {
    const rows = parseStatementLines([
      "Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance",
      "23/10/26 OPENING BALANCE 23/10/26 12,831.67",
      "24/10/26 UPI-SWIGGY-swiggy@icici 0000429812345 24/10/26 486.00 12,345.67",
      "ICIC0DC0099",
      "25/10/26 NEFT CR-ACME PVT LTD 0000429812346 25/10/26 95,000.00 1,07,345.67",
      "Page 1 of 3",
    ]);
    expect(rows).toEqual([
      {
        date: "2026-10-24T12:00:00.000Z",
        description: "UPI-SWIGGY-swiggy@icici ICIC0DC0099",
        amount: 486,
        direction: "debit",
      },
      {
        date: "2026-10-25T12:00:00.000Z",
        description: "NEFT CR-ACME PVT LTD",
        amount: 95000,
        direction: "credit",
      },
    ]);
  });
});

describe("toDrafts", () => {
  it("flags rows already in Munshi and leaves credits unselected", () => {
    const drafts = toDrafts(
      [
        {
          date: "2026-10-24T12:00:00.000Z",
          description: "UPI-SWIGGY-swiggy@icici",
          amount: 486,
          direction: "debit",
        },
        {
          date: "2026-10-25T12:00:00.000Z",
          description: "UPI-ZOMATO-zomato@hdfc",
          amount: 520,
          direction: "debit",
        },
        {
          date: "2026-10-25T12:00:00.000Z",
          description: "NEFT CR-ACME",
          amount: 95000,
          direction: "credit",
        },
      ],
      [
        {
          id: "x",
          merchant: "Swiggy",
          category: "Food & Dining",
          amount: 486,
          date: "2026-10-24T18:30:00.000Z",
        },
      ],
    );
    expect(drafts.map((d) => [d.merchant, d.duplicate, d.selected])).toEqual([
      ["Swiggy", true, false],
      ["Zomato", false, true],
      ["Acme", false, false],
    ]);
  });
});
