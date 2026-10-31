import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Category = "Food" | "Groceries" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Other";

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

export interface Subscription {
  name: string;
  amount: number;
  previousAmount?: number;
  cycle: "Monthly" | "Yearly";
  next: string;
  lastUsed: string;
  flag?: "forgotten" | "price-hike";
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
  { id: "1", merchant: "Swiggy", category: "Groceries", suggestedCategory: "Food", amount: 640, date: d(0), note: "Biryani order, tagged as Groceries" },
  { id: "2", merchant: "Zomato", category: "Food", amount: 520, date: d(1) },
  { id: "3", merchant: "Blinkit", category: "Groceries", amount: 1240, date: d(1) },
  { id: "4", merchant: "Uber", category: "Transport", amount: 320, date: d(2) },
  { id: "5", merchant: "Netflix", category: "Entertainment", amount: 649, date: d(2) },
  { id: "6", merchant: "Third Wave Coffee", category: "Food", amount: 410, date: d(3) },
  { id: "7", merchant: "House rent", category: "Bills", amount: 22000, date: d(4) },
  { id: "8", merchant: "Swiggy", category: "Food", amount: 780, date: d(5) },
  { id: "9", merchant: "Disney+ Hotstar", category: "Entertainment", amount: 299, date: d(6) },
  { id: "10", merchant: "Myntra", category: "Shopping", amount: 2899, date: d(7) },
  { id: "11", merchant: "Social, Indiranagar", category: "Food", amount: 2350, date: d(8) },
  { id: "12", merchant: "Airtel broadband", category: "Bills", amount: 999, date: d(9) },
  { id: "13", merchant: "Petrol", category: "Transport", amount: 2500, date: d(10) },
  { id: "14", merchant: "Zomato", category: "Food", amount: 690, date: d(12) },
  { id: "15", merchant: "DMart", category: "Groceries", amount: 3150, date: d(14) },
  { id: "16", merchant: "Swiggy", category: "Food", amount: 560, date: d(16) },
];

const DEMO_SUBS: Subscription[] = [
  { name: "Disney+ Hotstar", amount: 299, cycle: "Monthly", next: "6 Nov", lastUsed: "4 months ago", flag: "forgotten" },
  { name: "Netflix", amount: 649, previousAmount: 499, cycle: "Monthly", next: "2 Nov", lastUsed: "Yesterday", flag: "price-hike" },
  { name: "Spotify", amount: 119, cycle: "Monthly", next: "9 Nov", lastUsed: "Today" },
  { name: "Amazon Prime", amount: 1499, cycle: "Yearly", next: "14 Feb", lastUsed: "Last week" },
  { name: "Cult.fit", amount: 1299, cycle: "Monthly", next: "18 Nov", lastUsed: "3 weeks ago" },
];

const DEMO_GOALS: Goal[] = [
  { id: "g1", name: "Emergency fund", saved: 85000, target: 300000, due: "Mar 2027", status: "At risk", note: "Needs ₹43,000/month — you're saving ₹12,000." },
  { id: "g2", name: "Goa trip", saved: 28000, target: 45000, due: "Dec 2026", status: "On track", note: "₹8,500/month gets you there." },
  { id: "g3", name: "New laptop", saved: 52000, target: 120000, due: "Jun 2027", status: "Ahead", note: "A month ahead of plan." },
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
  subscriptions: Subscription[];
  goals: Goal[];
  add: (t: Omit<Transaction, "id">) => void;
  recategorize: (id: string, category: Category) => void;
  cancelSub: (name: string) => void;
  loadDemo: () => void;
  reset: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);
const KEY = "munshi-ai-demo";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [demo, setDemo] = useState(false);
  const [transactions, setTx] = useState<Transaction[]>([]);
  const [subscriptions, setSubs] = useState<Subscription[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const loadDemo = () => {
    setTx(DEMO_TX);
    setSubs(DEMO_SUBS);
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
      setTx((prev) => prev.map((t) => (t.id === id ? { ...t, category, suggestedCategory: undefined } : t))),
    cancelSub: (name) => setSubs((prev) => prev.filter((s) => s.name !== name)),
    loadDemo,
    reset: () => {
      localStorage.removeItem(KEY);
      setTx([]);
      setSubs([]);
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
