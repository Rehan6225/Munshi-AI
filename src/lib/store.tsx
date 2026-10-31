import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { migrateCategory, type Category } from "./categories";
import { detectRecurring, merchantKey, type Recurring, type Usage } from "./recurring";
import { findRule, suggestCategories, type Rule } from "./rules";
import {
  fixedCosts,
  monthlyInvested,
  monthlySpend,
  monthsFromNow,
  planGoals,
  type FixedCost,
  type Goal,
  type GoalPlan,
  type Profile,
} from "./plan";

export type { Category };

export interface Transaction {
  id: string;
  merchant: string;
  category: Category;
  amount: number;
  date: string; // ISO
  note?: string;
  /** Set when a learned rule picked the category. */
  ruleId?: string | undefined;
}

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const DEMO_TX: Transaction[] = [
  {
    id: "1",
    merchant: "Swiggy",
    category: "Groceries",
    amount: 640,
    date: d(0),
    note: "Biryani order",
  },
  { id: "2", merchant: "Zomato", category: "Food & Dining", amount: 520, date: d(1) },
  { id: "3", merchant: "Blinkit", category: "Groceries", amount: 1240, date: d(1) },
  { id: "4", merchant: "Uber", category: "Transport", amount: 320, date: d(2) },
  { id: "6", merchant: "Third Wave Coffee", category: "Food & Dining", amount: 410, date: d(3) },
  { id: "7", merchant: "Apollo Pharmacy", category: "Health", amount: 860, date: d(4) },
  { id: "8", merchant: "Swiggy", category: "Food & Dining", amount: 780, date: d(5) },
  { id: "10", merchant: "Myntra", category: "Shopping", amount: 2899, date: d(7) },
  {
    id: "11",
    merchant: "Social, Indiranagar",
    category: "Food & Dining",
    amount: 2350,
    date: d(8),
  },
  { id: "12", merchant: "Looks Salon", category: "Personal care", amount: 700, date: d(9) },
  { id: "13", merchant: "Petrol", category: "Transport", amount: 2500, date: d(10) },
  { id: "14", merchant: "Zomato", category: "Food & Dining", amount: 690, date: d(12) },
  { id: "15", merchant: "DMart", category: "Groceries", amount: 3150, date: d(14) },
  { id: "16", merchant: "Swiggy", category: "Food & Dining", amount: 560, date: d(16) },
  // Two dinners out push eating out well above the usual, so a drift nudge shows up.
  { id: "18", merchant: "Toit", category: "Food & Dining", amount: 1450, date: d(11) },
  { id: "19", merchant: "Truffles", category: "Food & Dining", amount: 980, date: d(6) },
  { id: "17", merchant: "Sent to Mom", category: "Family support", amount: 5000, date: d(18) },
];

/** One charge per cycle, oldest amount first, ending `latest` days ago. */
const charges = (
  merchant: string,
  category: Category,
  amounts: number[],
  latest: number,
  every = 30,
): Transaction[] =>
  amounts.map((amount, i) => ({
    id: `${merchant}-${i}`,
    merchant,
    category,
    amount,
    date: d(latest + (amounts.length - 1 - i) * every),
  }));

const six = (amount: number) => Array<number>(6).fill(amount);

/** Six months of autopay history, so subscriptions and bills are detected rather than hand-entered. */
const DEMO_RECURRING: Transaction[] = [
  ...charges("Netflix", "Subscriptions", [499, 499, 499, 499, 649, 649], 2),
  ...charges("Disney+ Hotstar", "Subscriptions", six(299), 6),
  ...charges("Spotify", "Subscriptions", six(119), 11),
  ...charges("Cult.fit", "Subscriptions", [1299, 1299, 1299, 1299], 13),
  ...charges("YouTube Premium", "Subscriptions", [149, 149], 3),
  ...charges("Amazon Prime", "Subscriptions", [1499, 1499], 260, 365),
  ...charges("House rent", "Rent & Housing", six(22000), 4),
  ...charges("Airtel broadband", "Utilities", six(999), 9),
  ...charges("BESCOM electricity", "Utilities", [1320, 1480, 1610, 1550, 1390, 1450], 7),
  ...charges("Bike EMI", "EMIs & Loans", six(3200), 5),
  ...charges("Star Health insurance", "Insurance", six(1250), 15),
  ...charges("Maid (Sunita)", "Household help", six(3000), 1),
  ...charges("Laundry & ironing", "Household help", six(600), 8),
  ...charges("Groww SIP", "Savings & Investments", six(10000), 5),
];

/** What the user told Munshi about when they last used each service. */
const DEMO_USAGE: Usage = {
  disneyhotstar: d(124),
  netflix: d(1),
  spotify: d(0),
  cultfit: d(21),
  amazonprime: d(7),
  youtubepremium: d(2),
};

/**
 * Five earlier months of everyday spending, so trends and "your usual" are real.
 * Eating out creeps up each month. Merchants land on alternating days of the month,
 * so one-off spends never look like a monthly subscription.
 */
function demoHistory(now = new Date()): Transaction[] {
  const months = [
    { ago: 5, food: 3200, groceries: 5400, transport: 3100, shopping: 1500 },
    { ago: 4, food: 3900, groceries: 5100, transport: 2800, shopping: 3200 },
    { ago: 3, food: 4400, groceries: 5600, transport: 3300, shopping: 1900 },
    { ago: 2, food: 5100, groceries: 5200, transport: 2900, shopping: 2600 },
    { ago: 1, food: 5800, groceries: 5500, transport: 3000, shopping: 2200 },
  ];
  const out: Transaction[] = [];
  for (const m of months) {
    const odd = m.ago % 2 === 1;
    const on = (day: number) =>
      new Date(now.getFullYear(), now.getMonth() - m.ago, day, 13).toISOString();
    const spend = (merchant: string, category: Category, amount: number, day: number) =>
      out.push({
        id: `h${m.ago}-${merchant}-${day}`,
        merchant,
        category,
        amount: Math.round(amount),
        date: on(day),
      });
    spend("Swiggy", "Food & Dining", m.food * 0.3, odd ? 4 : 9);
    spend("Zomato", "Food & Dining", m.food * 0.25, odd ? 11 : 26);
    spend("Swiggy", "Food & Dining", m.food * 0.25, odd ? 19 : 23);
    spend("Social, Indiranagar", "Food & Dining", m.food * 0.2, odd ? 27 : 6);
    spend("DMart", "Groceries", m.groceries * 0.6, odd ? 6 : 21);
    spend("Blinkit", "Groceries", m.groceries * 0.4, odd ? 18 : 3);
    spend("Petrol", "Transport", m.transport * 0.7, odd ? 8 : 24);
    spend("Uber", "Transport", m.transport * 0.3, odd ? 22 : 12);
    spend(odd ? "Myntra" : "Amazon", "Shopping", m.shopping, odd ? 14 : 17);
  }
  return out;
}

const DEMO_ALL_TX = [...DEMO_TX, ...DEMO_RECURRING, ...demoHistory()].sort((a, b) =>
  b.date.localeCompare(a.date),
);

const DEMO_PROFILE: Profile = {
  income: 120000,
  emergencyMonths: 6,
  extraFixedCosts: [],
  // A shopping budget, so the demo shows both kinds of nudge: budget and "over your usual".
  budgets: { Shopping: 2500 },
};

/** Targets and saved amounts only; status and advice are calculated in plan.ts. */
const DEMO_GOALS: Goal[] = [
  {
    id: "g1",
    name: "Emergency fund",
    emergency: true,
    target: 0,
    saved: 85000,
    due: monthsFromNow(5),
  },
  { id: "g2", name: "Goa trip", target: 45000, saved: 22000, due: monthsFromNow(3) },
  { id: "g3", name: "New laptop", target: 120000, saved: 52000, due: monthsFromNow(8) },
];

const EMPTY_PROFILE: Profile = { income: 0, emergencyMonths: 6, extraFixedCosts: [], budgets: {} };
const EMPTY_GOALS: Goal[] = [
  {
    id: "emergency",
    name: "Emergency fund",
    emergency: true,
    target: 0,
    saved: 0,
    due: monthsFromNow(12),
  },
];

export type Mode = "demo" | "own";

/** Everything that survives a refresh. */
interface Saved {
  mode: Mode | null;
  transactions: Transaction[];
  usage: Usage;
  cancelled: string[];
  profile: Profile;
  goals: Goal[];
  rules: Rule[];
}

const STORAGE_KEY = "munshi-ai:v1";
const EMPTY: Saved = {
  mode: null,
  transactions: [],
  usage: {},
  cancelled: [],
  profile: EMPTY_PROFILE,
  goals: EMPTY_GOALS,
  rules: [],
};
const DEMO: Saved = {
  mode: "demo",
  transactions: DEMO_ALL_TX,
  usage: DEMO_USAGE,
  cancelled: [],
  profile: DEMO_PROFILE,
  goals: DEMO_GOALS,
  rules: [],
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    // Fields added in later versions (like budgets) get their defaults.
    const saved = { ...EMPTY, ...parsed, profile: { ...EMPTY_PROFILE, ...parsed.profile } };
    // Data saved before the 18 categories used names like "Food" and "Bills".
    return {
      ...saved,
      transactions: saved.transactions.map((t) => ({
        ...t,
        category: migrateCategory(t.category),
      })),
      rules: saved.rules.map((r) => ({ ...r, category: migrateCategory(r.category) })),
    };
  } catch {
    return EMPTY;
  }
}

interface Ctx {
  hydrated: boolean;
  /** null until the user picks demo data or their own numbers. */
  mode: Mode | null;
  transactions: Transaction[];
  /** Recurring payments detected from transactions. */
  subscriptions: Recurring[];
  profile: Profile;
  /** Goals with calculated status and advice. */
  goals: GoalPlan[];
  /** Spent in the last 30 days. */
  spend: number;
  /** Put into savings and investments in the last 30 days. */
  invested: number;
  fixed: ReturnType<typeof fixedCosts>;
  rules: Rule[];
  /** Transaction id → the category its merchant is usually filed under. */
  suggestions: Map<string, Category>;
  /** Adds a transaction, letting a learned rule override its category. */
  add: (t: Omit<Transaction, "id">) => Transaction;
  recategorize: (id: string, category: Category) => void;
  /** Saves "merchant → category" and refiles past transactions. Returns how many changed. */
  learnRule: (merchant: string, category: Category) => number;
  removeRule: (id: string) => void;
  cancelSub: (key: string) => void;
  markUsed: (key: string) => void;
  markUnused: (key: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  addFixedCost: () => void;
  updateFixedCost: (id: string, patch: Partial<FixedCost>) => void;
  removeFixedCost: (id: string) => void;
  saveGoal: (goal: Goal) => void;
  addGoal: () => void;
  removeGoal: (id: string) => void;
  loadDemo: () => void;
  startOwn: () => void;
  reset: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<Saved>(EMPTY);
  const set = (fn: (s: Saved) => Partial<Saved>) => setState((s) => ({ ...s, ...fn(s) }));
  // Actions fired later (e.g. from a toast button) must see current data, not the render they came from.
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    // brief delay so skeletons are visible while "syncing"
    const t = setTimeout(() => {
      setState(load());
      setHydrated(true);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or full storage: the app still works for this session.
    }
  }, [hydrated, state]);

  const { transactions, usage, cancelled, profile } = state;
  const subscriptions = useMemo(
    () => detectRecurring(transactions, usage).filter((r) => !cancelled.includes(r.key)),
    [transactions, usage, cancelled],
  );
  const spend = useMemo(() => monthlySpend(transactions), [transactions]);
  const invested = useMemo(() => monthlyInvested(transactions), [transactions]);
  const suggestions = useMemo(() => suggestCategories(transactions), [transactions]);
  const fixed = useMemo(() => fixedCosts(subscriptions, profile), [subscriptions, profile]);
  const goals = useMemo(
    () =>
      planGoals(state.goals, {
        income: profile.income,
        spend,
        invested,
        fixed: fixed.total,
        emergencyMonths: profile.emergencyMonths,
      }),
    [state.goals, profile, spend, invested, fixed.total],
  );

  const value: Ctx = {
    hydrated,
    mode: state.mode,
    transactions,
    subscriptions,
    profile,
    goals,
    spend,
    invested,
    fixed,
    rules: state.rules,
    suggestions,
    add: (t) => {
      const rule = findRule(t.merchant, latest.current.rules);
      const tx: Transaction = rule
        ? { ...t, id: crypto.randomUUID(), category: rule.category, ruleId: rule.id }
        : { ...t, id: crypto.randomUUID() };
      set((s) => ({
        transactions: [tx, ...s.transactions],
        rules: rule
          ? s.rules.map((r) => (r.id === rule.id ? { ...r, applied: r.applied + 1 } : r))
          : s.rules,
        mode: s.mode ?? "own",
      }));
      return tx;
    },
    recategorize: (id, category) =>
      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.id === id ? { ...t, category, ruleId: undefined } : t,
        ),
      })),
    learnRule: (merchant, category) => {
      const key = merchantKey(merchant);
      const existing = latest.current.rules.find((r) => r.key === key);
      const rule: Rule = existing
        ? { ...existing, category }
        : {
            id: crypto.randomUUID(),
            key,
            merchant,
            category,
            applied: 0,
            createdAt: new Date().toISOString(),
          };
      const matching = latest.current.transactions.filter((t) => merchantKey(t.merchant) === key);
      const changed = matching.filter((t) => t.category !== category).length;
      set((s) => ({
        transactions: s.transactions.map((t) =>
          merchantKey(t.merchant) === key ? { ...t, category, ruleId: rule.id } : t,
        ),
        rules: [
          ...s.rules.filter((r) => r.key !== key),
          { ...rule, applied: existing ? existing.applied + changed : matching.length },
        ],
      }));
      return changed;
    },
    removeRule: (id) =>
      set((s) => ({
        rules: s.rules.filter((r) => r.id !== id),
        transactions: s.transactions.map((t) =>
          t.ruleId === id ? { ...t, ruleId: undefined } : t,
        ),
      })),
    cancelSub: (key) => set((s) => ({ cancelled: [...s.cancelled, key] })),
    markUsed: (key) => set((s) => ({ usage: { ...s.usage, [key]: new Date().toISOString() } })),
    markUnused: (key) => set((s) => ({ usage: { ...s.usage, [key]: null } })),
    updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
    addFixedCost: () =>
      set((s) => ({
        profile: {
          ...s.profile,
          extraFixedCosts: [
            ...s.profile.extraFixedCosts,
            { id: crypto.randomUUID(), name: "", amount: 0 },
          ],
        },
      })),
    updateFixedCost: (id, patch) =>
      set((s) => ({
        profile: {
          ...s.profile,
          extraFixedCosts: s.profile.extraFixedCosts.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        },
      })),
    removeFixedCost: (id) =>
      set((s) => ({
        profile: {
          ...s.profile,
          extraFixedCosts: s.profile.extraFixedCosts.filter((c) => c.id !== id),
        },
      })),
    saveGoal: (goal) => set((s) => ({ goals: s.goals.map((g) => (g.id === goal.id ? goal : g)) })),
    addGoal: () =>
      set((s) => ({
        goals: [
          ...s.goals,
          {
            id: crypto.randomUUID(),
            name: "New goal",
            target: 50000,
            saved: 0,
            due: monthsFromNow(6),
          },
        ],
      })),
    removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
    loadDemo: () => setState(DEMO),
    startOwn: () => setState({ ...EMPTY, mode: "own" }),
    reset: () => setState(EMPTY),
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
