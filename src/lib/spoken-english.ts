/**
 * For speaking English text (the Coach's answers) with Munshi's Hindi voice: that voice
 * reads bare digits in Hindi, so every number is spelled out in English words first.
 */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
    if (n) parts.push("and");
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)]! + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  else if (n > 0 || !parts.length) parts.push(ONES[n]!);
  return parts.join(" ");
}

/** 120000 → "one lakh twenty thousand", using the Indian system (thousand, lakh, crore). */
export function numberToWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "zero";
  const parts: string[] = [];
  for (const [size, name] of [
    [1_00_00_000, "crore"],
    [1_00_000, "lakh"],
    [1_000, "thousand"],
  ] as const) {
    if (n >= size) {
      parts.push(`${numberToWords(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(belowThousand(n));
  return (value < 0 ? "minus " : "") + parts.join(" ");
}

const words = (n: string) => numberToWords(Number(n.replace(/,/g, "")));

/** "₹1,980 over 3 payments, 52%" → "one thousand nine hundred and eighty rupees over three payments, fifty two percent". */
export function spokenEnglish(text: string) {
  return text
    .replace(/₹\s?(\d[\d,]*)(?:\.\d+)?/g, (_, n: string) => {
      const w = words(n);
      return `${w} ${w === "one" ? "rupee" : "rupees"}`;
    })
    .replace(/(\d[\d,]*)(?:\.\d+)?\s?%/g, (_, n: string) => `${words(n)} percent`)
    .replace(/\d[\d,]*/g, (n) => words(n));
}
