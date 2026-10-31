import { createContext, useContext, useState, type ReactNode } from "react";

export type Category = "Food" | "Groceries" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Other";

export interface Transaction {
  id: string;
  merchant: string;
  category: Category;
  amount: number;
  date: string; // ISO
  note?: string;
}

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const SEED: Transaction[] = [
  { id: "1", merchant: "Swiggy", category: "Food", amount: 480, date: d(0) },
  { id: "2", merchant: "Blinkit", category: "Groceries", amount: 1240, date: d(1) },
  { id: "3", merchant: "Uber", category: "Transport", amount: 320, date: d(1) },
  { id: "4", merchant: "House rent", category: "Bills", amount: 22000, date: d(3) },
  { id: "5", merchant: "Myntra", category: "Shopping", amount: 2899, date: d(4) },
  { id: "6", merchant: "Netflix", category: "Entertainment", amount: 649, date: d(5) },
  { id: "7", merchant: "Zomato", category: "Food", amount: 612, date: d(6) },
  { id: "8", merchant: "Airtel broadband", category: "Bills", amount: 999, date: d(8) },
  { id: "9", merchant: "Petrol", category: "Transport", amount: 2500, date: d(9) },
  { id: "10", merchant: "DMart", category: "Groceries", amount: 3150, date: d(11) },
];

export const PROFILE = {
  monthlyIncome: 95000,
  emergencyFund: { saved: 185000, target: 300000 },
  goals: [
    { id: "g1", name: "Goa trip", saved: 28000, target: 45000, due: "Dec 2026" },
    { id: "g2", name: "New laptop", saved: 52000, target: 120000, due: "Mar 2027" },
    { id: "g3", name: "House down payment", saved: 340000, target: 1500000, due: "2029" },
  ],
  subscriptions: [
    { name: "Netflix", amount: 649, cycle: "Monthly", next: "5 Nov" },
    { name: "Spotify", amount: 119, cycle: "Monthly", next: "9 Nov" },
    { name: "Amazon Prime", amount: 1499, cycle: "Yearly", next: "14 Feb" },
    { name: "Cult.fit", amount: 1299, cycle: "Monthly", next: "18 Nov" },
    { name: "iCloud 200GB", amount: 219, cycle: "Monthly", next: "22 Nov" },
  ],
};

interface Ctx {
  transactions: Transaction[];
  add: (t: Omit<Transaction, "id">) => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [transactions, setTx] = useState<Transaction[]>(SEED);
  const add: Ctx["add"] = (t) => setTx((prev) => [{ ...t, id: crypto.randomUUID() }, ...prev]);
  return <StoreCtx.Provider value={{ transactions, add }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
