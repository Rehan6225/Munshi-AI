import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectRecurring, type Recurring, type Usage } from "./recurring";
import {
  fixedCosts,
  monthlySpend,
  monthsFromNow,
  planGoals,
  type FixedCost,
  type Goal,
  type GoalPlan,
  type Profile,
} from "./plan";

export type Category =
  "Food" | "Groceries" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Other";

export interface Transaction {
  id: string;
  merchant: string;
  category: Category;
  amount: number;
  date: string; // ISO
  note?: string;
  /** Category the coach thinks is correct, if the current one looks wrong. */
  suggestedCategory?: Category | undefined;
}

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const DEMO_TX: Transaction[] = [
  {
    id: "1",
    merchant: "Swiggy",
    category: "Groceries",
    suggestedCategory: "Food",
    amount: 640,
    date: d(0),
    note: "Biryani order, tagged as Groceries",
  },
  { id: "2", merchant: "Zomato", category: "Food", amount: 520, date: d(1) },
  { id: "3", merchant: "Blinkit", category: "Groceries", amount: 1240, date: d(1) },
  { id: "4", merchant: "Uber", category: "Transport", amount: 320, date: d(2) },
  { id: "6", merchant: "Third Wave Coffee", category: "Food", amount: 410, date: d(3) },
  { id: "8", merchant: "Swiggy", category: "Food", amount: 780, date: d(5) },
  { id: "10", merchant: "Myntra", category: "Shopping", amount: 2899, date: d(7) },
  { id: "11", merchant: "Social, Indiranagar", category: "Food", amount: 2350, date: d(8) },
  { id: "13", merchant: "Petrol", category: "Transport", amount: 2500, date: d(10) },
  { id: "14", merchant: "Zomato", category: "Food", amount: 690, date: d(12) },
  { id: "15", merchant: "DMart", category: "Groceries", amount: 3150, date: d(14) },
  { id: "16", merchant: "Swiggy", category: "Food", amount: 560, date: d(16) },
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

/** Six months of autopay history, so subscriptions are detected rather than hand-entered. */
const DEMO_RECURRING: Transaction[] = [
  ...charges("Netflix", "Entertainment", [499, 499, 499, 499, 649, 649], 2),
  ...charges("Disney+ Hotstar", "Entertainment", [299, 299, 299, 299, 299, 299], 6),
  ...charges("Spotify", "Entertainment", [119, 119, 119, 119, 119, 119], 11),
  ...charges("Cult.fit", "Other", [1299, 1299, 1299, 1299], 13),
  ...charges("YouTube Premium", "Entertainment", [149, 149], 3),
  ...charges("Amazon Prime", "Shopping", [1499, 1499], 260, 365),
  ...charges("House rent", "Bills", [22000, 22000, 22000, 22000, 22000, 22000], 4),
  ...charges("Airtel broadband", "Bills", [999, 999, 999, 999, 999, 999], 9),
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

const DEMO_ALL_TX = [...DEMO_TX, ...DEMO_RECURRING].sort((a, b) => b.date.localeCompare(a.date));

const DEMO_PROFILE: Profile = { income: 95000, emergencyMonths: 6, extraFixedCosts: [] };

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

const EMPTY_PROFILE: Profile = { income: 0, emergencyMonths: 6, extraFixedCosts: [] };
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

/** Eating-out spend over the last 6 months — trending up. */
export const DEMO_EATING_OUT = [
  { month: "May", amount: 3200 },
  { month: "Jun", amount: 3900 },
  { month: "Jul", amount: 4400 },
  { month: "Aug", amount: 5100 },
  { month: "Sep", amount: 5800 },
  { month: "Oct", amount: 6950 },
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
}

const STORAGE_KEY = "munshi-ai:v1";
const EMPTY: Saved = {
  mode: null,
  transactions: [],
  usage: {},
  cancelled: [],
  profile: EMPTY_PROFILE,
  goals: EMPTY_GOALS,
};
const DEMO: Saved = {
  mode: "demo",
  transactions: DEMO_ALL_TX,
  usage: DEMO_USAGE,
  cancelled: [],
  profile: DEMO_PROFILE,
  goals: DEMO_GOALS,
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) } : EMPTY;
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
  fixed: ReturnType<typeof fixedCosts>;
  add: (t: Omit<Transaction, "id">) => void;
  recategorize: (id: string, category: Category) => void;
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
  const fixed = useMemo(() => fixedCosts(subscriptions, profile), [subscriptions, profile]);
  const goals = useMemo(
    () =>
      planGoals(state.goals, {
        income: profile.income,
        spend,
        fixed: fixed.total,
        emergencyMonths: profile.emergencyMonths,
      }),
    [state.goals, profile, spend, fixed.total],
  );

  const value: Ctx = {
    hydrated,
    mode: state.mode,
    transactions,
    subscriptions,
    profile,
    goals,
    spend,
    fixed,
    add: (t) =>
      set((s) => ({
        transactions: [{ ...t, id: crypto.randomUUID() }, ...s.transactions],
        mode: s.mode ?? "own",
      })),
    recategorize: (id, category) =>
      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.id === id ? { ...t, category, suggestedCategory: undefined } : t,
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
