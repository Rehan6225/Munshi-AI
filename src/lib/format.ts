const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,00,000 style (Indian digit grouping). */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}

/** Short form: ₹4.5L, ₹1.2Cr, ₹12,400. */
export function formatINRShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)}L`;
  return formatINR(amount);
}

function trim(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, "");
}
