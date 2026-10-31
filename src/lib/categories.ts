export type CategoryGroup = "Commitments" | "Essentials" | "Lifestyle" | "Money moves";

export const CATEGORY_INFO = {
  "Rent & Housing": { group: "Commitments", emoji: "🏠", hint: "rent, society maintenance" },
  Utilities: {
    group: "Commitments",
    emoji: "💡",
    hint: "electricity, water, gas, LPG, mobile recharge, broadband, DTH",
  },
  "EMIs & Loans": {
    group: "Commitments",
    emoji: "🏦",
    hint: "home, car, bike, personal, credit-card EMIs",
  },
  Insurance: { group: "Commitments", emoji: "🛡️", hint: "health, term life, vehicle premiums" },
  "Household help": {
    group: "Commitments",
    emoji: "🧹",
    hint: "maid, cook, driver, laundry, ironing, dhobi",
  },
  Education: {
    group: "Commitments",
    emoji: "🎓",
    hint: "school or college fees, tuition, coaching, courses",
  },
  "Family support": { group: "Commitments", emoji: "👨‍👩‍👧", hint: "money sent to parents or family" },
  Subscriptions: {
    group: "Commitments",
    emoji: "🔁",
    hint: "Netflix, Hotstar, Spotify, Prime, YouTube, gym",
  },
  Groceries: {
    group: "Essentials",
    emoji: "🥦",
    hint: "Blinkit, Zepto, DMart, BigBasket, kirana, milk, vegetables",
  },
  Transport: {
    group: "Essentials",
    emoji: "🚗",
    hint: "fuel, Uber, Ola, Rapido, auto, metro, bus, parking",
  },
  Health: {
    group: "Essentials",
    emoji: "💊",
    hint: "medicines, pharmacy, doctor, hospital, lab tests",
  },
  "Food & Dining": {
    group: "Lifestyle",
    emoji: "🍕",
    hint: "Swiggy, Zomato, restaurants, cafés, chai, coffee, takeaway",
  },
  Shopping: { group: "Lifestyle", emoji: "🛍️", hint: "Amazon, Flipkart, Myntra, clothes, gadgets" },
  Entertainment: { group: "Lifestyle", emoji: "🎬", hint: "movies, events, outings, games" },
  "Personal care": { group: "Lifestyle", emoji: "💇", hint: "salon, haircut, spa, grooming" },
  Travel: { group: "Lifestyle", emoji: "✈️", hint: "trips, flights, trains, hotels" },
  "Savings & Investments": {
    group: "Money moves",
    emoji: "📈",
    hint: "SIP, mutual funds, RD, PPF, NPS, stocks",
  },
  Other: { group: "Money moves", emoji: "❓", hint: "anything else" },
} as const satisfies Record<string, { group: CategoryGroup; emoji: string; hint: string }>;

export type Category = keyof typeof CATEGORY_INFO;

export const CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

export const CATEGORY_GROUPS: { group: CategoryGroup; categories: Category[] }[] = (
  ["Commitments", "Essentials", "Lifestyle", "Money moves"] as const
).map((group) => ({
  group,
  categories: CATEGORIES.filter((c) => CATEGORY_INFO[c].group === group),
}));

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && Object.hasOwn(CATEGORY_INFO, value);
}

/** Paid every month no matter what: these make up fixed costs. */
export function isFixed(c: Category) {
  return CATEGORY_INFO[c].group === "Commitments";
}

/** Money moved into savings or investments isn't spending. */
export function isSaving(c: Category) {
  return c === "Savings & Investments";
}

/** Categories from before the 18-category list, mapped for data saved in older versions. */
const LEGACY: Record<string, Category> = { Food: "Food & Dining", Bills: "Utilities" };

export function migrateCategory(value: unknown): Category {
  if (isCategory(value)) return value;
  return typeof value === "string" && Object.hasOwn(LEGACY, value) ? LEGACY[value]! : "Other";
}
