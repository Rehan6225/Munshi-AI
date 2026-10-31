import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectRecurring, type Recurring, type Usage } from "./recurring";

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

export interface Goal {
  id: string;
  name: string;
  saved: number;
  target: number;
  due: string;
  status: "On track" | "At risk" | "Ahead";
  note: string;
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

const DEMO_GOALS: Goal[] = [
  {
    id: "g1",
    name: "Emergency fund",
    saved: 85000,
    target: 300000,
    due: "Mar 2027",
    status: "At risk",
    note: "Needs ₹43,000/month — you're saving ₹12,000.",
  },
  {
    id: "g2",
    name: "Goa trip",
    saved: 28000,
    target: 45000,
    due: "Dec 2026",
    status: "On track",
    note: "₹8,500/month gets you there.",
  },
  {
    id: "g3",
    name: "New laptop",
    saved: 52000,
    target: 120000,
    due: "Jun 2027",
    status: "Ahead",
    note: "A month ahead of plan.",
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

export const MONTHLY_INCOME = 95000;

interface Ctx {
  hydrated: boolean;
  demo: boolean;
  transactions: Transaction[];
  /** Recurring payments detected from transactions. */
  subscriptions: Recurring[];
  goals: Goal[];
  add: (t: Omit<Transaction, "id">) => void;
  recategorize: (id: string, category: Category) => void;
  cancelSub: (key: string) => void;
  markUsed: (key: string) => void;
  markUnused: (key: string) => void;
  loadDemo: () => void;
  reset: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);
const KEY = "munshi-ai-demo";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [demo, setDemo] = useState(false);
  const [transactions, setTx] = useState<Transaction[]>([]);
  const [usage, setUsage] = useState<Usage>({});
  const [cancelled, setCancelled] = useState<string[]>([]);
  const subscriptions = useMemo(
    () => detectRecurring(transactions, usage).filter((r) => !cancelled.includes(r.key)),
    [transactions, usage, cancelled],
  );
  const [goals, setGoals] = useState<Goal[]>([]);

  const loadDemo = () => {
    setTx(DEMO_ALL_TX);
    setUsage(DEMO_USAGE);
    setCancelled([]);
    setGoals(DEMO_GOALS);
    setDemo(true);
    localStorage.setItem(KEY, "1");
  };

  useEffect(() => {
    // brief delay so skeletons are visible while "syncing"
    const t = setTimeout(() => {
      if (localStorage.getItem(KEY)) loadDemo();
      setHydrated(true);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  const value: Ctx = {
    hydrated,
    demo,
    transactions,
    subscriptions,
    goals,
    add: (t) => {
      setTx((prev) => [{ ...t, id: crypto.randomUUID() }, ...prev]);
      setDemo(true);
    },
    recategorize: (id, category) =>
      setTx((prev) =>
        prev.map((t) => (t.id === id ? { ...t, category, suggestedCategory: undefined } : t)),
      ),
    cancelSub: (key) => setCancelled((prev) => [...prev, key]),
    markUsed: (key) => setUsage((prev) => ({ ...prev, [key]: new Date().toISOString() })),
    markUnused: (key) => setUsage((prev) => ({ ...prev, [key]: null })),
    loadDemo,
    reset: () => {
      localStorage.removeItem(KEY);
      setTx([]);
      setUsage({});
      setCancelled([]);
      setGoals([]);
      setDemo(false);
    },
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
