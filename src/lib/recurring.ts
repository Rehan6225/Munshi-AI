import type { Category, Transaction } from "./store";

const DAY = 86400000;

export type RecurringAlert = "price-up" | "price-down" | "unused" | "new";

export interface Recurring {
  /** Normalised merchant, e.g. "disneyhotstar". */
  key: string;
  name: string;
  category: Category;
  /** Subscriptions can go unused; bills (rent, broadband) can't. */
  kind: "subscription" | "bill";
  cycle: "Monthly" | "Yearly";
  amount: number;
  /** Set when the latest charge differs from the one before it. */
  previousAmount?: number | undefined;
  changedOn?: string | undefined;
  charges: number;
  firstCharged: string;
  lastCharged: string;
  next: string;
  /** null = the user said they don't use it; undefined = we don't know. */
  lastUsed?: string | null | undefined;
  alerts: RecurringAlert[];
}

/** Per-merchant usage check-ins: ISO date of last use, or null for "I don't use this". */
export type Usage = Record<string, string | null>;

const UNUSED_AFTER_DAYS = 45;
const NEW_WITHIN_DAYS = 70;
const PRICE_CHANGE_WITHIN_DAYS = 95;

/** Services that bill on a cycle by nature, so a single charge is enough to list them. */
const KNOWN_RECURRING =
  /netflix|spotify|hotstar|disney|amazon prime|prime video|youtube premium|cult\.? ?fit|zee5|sonyliv|jiocinema|audible|gaana|wynk|apple music|icloud|google one|\brent\b|broadband|fibernet|fiber|hathway|tata play|insurance|\blic\b/i;

/** How banks mark a payment that repeats on its own: standing instructions and mandates. */
export const AUTOPAY =
  /\b(si|e-?mandate|mandate|autopay|auto pay|auto-debit|ach|nach|standing instruction)\b/i;

/** True when one charge is enough to call this a subscription or bill. */
export function looksRecurring(t: Pick<Transaction, "merchant" | "recurring">) {
  return Boolean(t.recurring) || KNOWN_RECURRING.test(t.merchant);
}

export function merchantKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Finds payments that repeat on a monthly or yearly rhythm. Amount changes are allowed
 * (that's how price hikes show up); irregular timing, like food orders, is not.
 */
export function detectRecurring(
  transactions: Transaction[],
  usage: Usage = {},
  now = Date.now(),
): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = merchantKey(t.merchant);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: Recurring[] = [];
  for (const [key, txs] of groups) {
    // One statement shows each subscription once; trust known services and autopay marks.
    const single = txs.length === 1;
    if (single && !looksRecurring(txs[0]!)) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const times = sorted.map((t) => new Date(t.date).getTime());
    const gaps = times.slice(1).map((t, i) => (t - times[i]!) / DAY);

    const cycle = single
      ? /prime|annual|yearly/i.test(sorted[0]!.merchant) && sorted[0]!.amount >= 999
        ? "Yearly"
        : "Monthly"
      : gaps.every((g) => g >= 25 && g <= 35)
        ? "Monthly"
        : gaps.every((g) => g >= 350 && g <= 380)
          ? "Yearly"
          : null;
    if (!cycle) continue;
    // Two food orders a month apart aren't a subscription; with so little history, the
    // amounts must match too unless it's a service we know repeats.
    if (sorted.length === 2 && !sorted.some(looksRecurring)) {
      const [a, b] = sorted.map((t) => t.amount) as [number, number];
      if (Math.abs(a - b) / Math.max(a, b) > 0.1) continue;
    }

    const last = sorted.at(-1)!;
    const avgGap = single
      ? cycle === "Yearly"
        ? 365
        : 30
      : gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const kind = last.category === "Bills" ? "bill" : "subscription";
    const lastUsed = usage[key];

    // Walk back to the last charge at a different price; flag it if the change is recent.
    const samePrice = (t: Transaction) => Math.abs(t.amount - last.amount) / last.amount <= 0.02;
    let before = sorted.length - 1;
    while (before >= 0 && samePrice(sorted[before]!)) before--;
    const prev = before >= 0 ? sorted[before]! : undefined;
    const changedOn = prev ? sorted[before + 1]!.date : undefined;
    const changed =
      !!changedOn && now - new Date(changedOn).getTime() < PRICE_CHANGE_WITHIN_DAYS * DAY;

    const alerts: RecurringAlert[] = [];
    if (changed) alerts.push(last.amount > prev!.amount ? "price-up" : "price-down");
    if (
      kind === "subscription" &&
      (lastUsed === null ||
        (lastUsed && now - new Date(lastUsed).getTime() > UNUSED_AFTER_DAYS * DAY))
    )
      alerts.push("unused");
    // With a single charge we can't tell a new sign-up from history we haven't seen.
    if (!single && now - times[0]! < NEW_WITHIN_DAYS * DAY) alerts.push("new");

    found.push({
      key,
      name: last.merchant,
      category: last.category,
      kind,
      cycle,
      amount: last.amount,
      previousAmount: changed ? prev!.amount : undefined,
      changedOn: changed ? changedOn : undefined,
      charges: sorted.length,
      firstCharged: sorted[0]!.date,
      lastCharged: last.date,
      next: new Date(times.at(-1)! + avgGap * DAY).toISOString(),
      lastUsed,
      alerts,
    });
  }

  // Things needing attention first, then the most expensive.
  return found.sort((a, b) => b.alerts.length - a.alerts.length || yearlyCost(b) - yearlyCost(a));
}

export function yearlyCost(r: Pick<Recurring, "amount" | "cycle">) {
  return r.cycle === "Yearly" ? r.amount : r.amount * 12;
}

export function daysSince(iso: string, now = Date.now()) {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export type UsageCommand = { action: "unused" | "used" | "cancel"; sub: Recurring };

/** Understands things like "I never use Hotstar", "cancel my Netflix", "watched Netflix yesterday". */
export function parseUsageCommand(text: string, subs: Recurring[]): UsageCommand | null {
  const lower = text.toLowerCase();
  const sub = subs.find((s) =>
    s.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => word.length >= 4 && lower.includes(word)),
  );
  if (!sub) return null;
  if (
    /never use|don'?t use|do not use|not using|stopped using|haven'?t (used|watched|opened)|no longer use/.test(
      lower,
    )
  )
    return { action: "unused", sub };
  if (/\bcancel|unsubscribe|stop (my|the)\b/.test(lower)) return { action: "cancel", sub };
  if (/\b(used|using|watched|watching|listened|opened|went to)\b/.test(lower))
    return { action: "used", sub };
  return null;
}
