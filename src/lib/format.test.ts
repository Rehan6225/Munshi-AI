import { describe, expect, it } from "vitest";
import { formatINR, formatINRShort } from "./format";

describe("INR formatting", () => {
  it("uses Indian grouping for 1 lakh", () => {
    expect(formatINR(100000)).toBe("₹1,00,000");
  });
  it("groups 12.5 lakh as 12,50,000", () => {
    expect(formatINR(1250000)).toBe("₹12,50,000");
  });
  it("short form uses L and Cr", () => {
    expect(formatINRShort(450000)).toBe("₹4.5L");
    expect(formatINRShort(12000000)).toBe("₹1.2Cr");
  });
});
