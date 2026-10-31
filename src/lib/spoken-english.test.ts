import { describe, expect, it } from "vitest";
import { numberToWords, spokenEnglish } from "./spoken-english";

describe("numberToWords", () => {
  it.each([
    [0, "zero"],
    [7, "seven"],
    [42, "forty two"],
    [480, "four hundred and eighty"],
    [1980, "one thousand nine hundred and eighty"],
    [52400, "fifty two thousand four hundred"],
    [120000, "one lakh twenty thousand"],
    [345798, "three lakh forty five thousand seven hundred and ninety eight"],
    [25000000, "two crore fifty lakh"],
  ])("%d → %s", (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });
});

describe("spokenEnglish", () => {
  it("spells out rupees, percentages and plain numbers in English", () => {
    expect(spokenEnglish("You spent ₹1,980 at Swiggy, over 3 payments. Savings rate 52%.")).toBe(
      "You spent one thousand nine hundred and eighty rupees at Swiggy, over three payments. Savings rate fifty two percent.",
    );
  });

  it("leaves no digits for the voice to read in Hindi", () => {
    expect(spokenEnglish("₹1,20,000 by Mar 2027, ₹1 left")).not.toMatch(/\d/);
    expect(spokenEnglish("₹1 left")).toBe("one rupee left");
  });
});
