import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectRecurring, merchantKey, type Recurring, type Usage } from "./recurring";
import type { Rules } from "./importers/categorize";
import { monthFrom, planGoal } from "./plan";
import type { ImportSource } from "./importers/rows";

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
  /** Set on rows brought in from a statement, CSV or SMS. */
  source?: ImportSource | undefined;
  /** The bank marked it as autopay (SI, mandate, ACH), so it repeats even if seen once. */
  recurring?: boolean | undefined;
}

/** What the user tells Munshi about a goal. */
export interface GoalInput {
  id: string;
  name: string;
  saved: number;
  target: number;
  /** Month to reach it by, "2027-03". */
  due: string;
  /** What the user puts aside for it each month. */
  monthly: number;
}

/** A goal with its status and advice worked out from the inputs. */
export interface Goal extends GoalInput {
  status: "On track" | "At risk" | "Ahead" | "Reached";
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

/** Due dates are relative to today so the demo always tells the same story. */
const demoGoals = (now = new Date()): GoalInput[] => [
  {
    id: "g1",
    name: "Emergency fund",
    saved: 85000,
    target: 300000,
    due: monthFrom(now, 5),
    monthly: 12000,
  },
  {
    id: "g2",
    name: "Goa trip",
    saved: 28000,
    target: 45000,
    due: monthFrom(now, 2),
    monthly: 8500,
  },
  {
    id: "g3",
    name: "New laptop",
    saved: 52000,
    target: 120000,
    due: monthFrom(now, 8),
    monthly: 9800,
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

/** The salary the demo and the sample files assume. Real data asks the user instead. */
export const MONTHLY_INCOME = 95000;

/** One set of money data. The demo and the user's own data are kept apart. */
interface Workspace {
  transactions: Transaction[];
  usage: Usage;
  cancelled: string[];
  goals: GoalInput[];
  /** Monthly take-home pay; null until the user tells us. */
  income: number | null;
  /** The income is a stand-in (demo or sample data), not something the user entered. */
  incomeAssumed: boolean;
}

export type Mode = "demo" | "mine";

const emptyWorkspace = (): Workspace => ({
  transactions: [],
  usage: {},
  cancelled: [],
  goals: [],
  income: null,
  incomeAssumed: false,
});

const demoWorkspace = (): Workspace => ({
  transactions: DEMO_ALL_TX,
  usage: DEMO_USAGE,
  cancelled: [],
  goals: demoGoals(),
  income: MONTHLY_INCOME,
  incomeAssumed: true,
});

interface Ctx {
  hydrated: boolean;
  /** Which data is on screen; null until the user tries the demo or adds their own. */
  mode: Mode | null;
  /** True when the user has data of their own, whatever is on screen. */
  hasOwnData: boolean;
  transactions: Transaction[];
  /** Recurring payments detected from transactions. */
  subscriptions: Recurring[];
  goals: Goal[];
  /** Take-home pay per month; null when the user hasn't said yet. */
  income: number | null;
  /** True when income is the demo's or sample's stand-in rather than the user's own. */
  incomeAssumed: boolean;
  /** The user's own figure. */
  setIncome: (income: number) => void;
  /** Uses the stand-in salary for sample data, unless the user already gave theirs. */
  assumeSampleIncome: () => void;
  /** True once the user has told us their own salary. */
  ownIncomeSet: boolean;
  /** Set while the "what's your monthly salary?" dialog should be open. */
  incomePrompt: { suggested: number | null } | null;
  askIncome: (suggested?: number | null) => void;
  closeIncomePrompt: () => void;
  addGoal: (g: Omit<GoalInput, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<GoalInput, "id">>) => void;
  removeGoal: (id: string) => void;
  /** Categories the user picked by hand, by merchant. Applied to imports and voice entries. */
  rules: Rules;
  add: (t: Omit<Transaction, "id">) => void;
  /**
   * Adds imported rows to the user's own data, never the demo.
   * Returns true when that meant switching away from the demo.
   */
  addMany: (txs: Omit<Transaction, "id">[]) => boolean;
  /** Remembers a merchant's category for next time. Returns false if it already knew. */
  learn: (merchant: string, category: Category) => boolean;
  /** Fixes one transaction's category and remembers it for that merchant. */
  recategorize: (id: string, category: Category) => void;
  cancelSub: (key: string) => void;
  markUsed: (key: string) => void;
  markUnused: (key: string) => void;
  /** Shows a fresh copy of the demo. The user's own data is untouched. */
  loadDemo: () => void;
  /** Switches to the user's own data. */
  showMine: () => void;
  /** Leaves the demo, or deletes the user's own data when that's on screen. */
  reset: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);
/** Which data was on screen last time. */
const MODE_KEY = "munshi-ai-mode";
/** Before demo and own data were separate, this flag meant "showing the demo". */
const LEGACY_DEMO_KEY = "munshi-ai-demo";
/** The user's own data, so imports and logged spends survive a reload. */
const DATA_KEY = "munshi-ai-data";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [spaces, setSpaces] = useState<Record<Mode, Workspace>>(() => ({
    demo: emptyWorkspace(),
    mine: emptyWorkspace(),
  }));
  const [rules, setRules] = useState<Rules>({});
  const [incomePrompt, setIncomePrompt] = useState<Ctx["incomePrompt"]>(null);

  const active = spaces[mode ?? "mine"];
  const { transactions, usage, cancelled, income, incomeAssumed } = active;
  const subscriptions = useMemo(
    () => detectRecurring(transactions, usage).filter((r) => !cancelled.includes(r.key)),
    [transactions, usage, cancelled],
  );
  const goals = useMemo(
    () => active.goals.map((g): Goal => ({ ...g, ...planGoal(g) })),
    [active.goals],
  );

  /** Changes the data on screen. With nothing on screen yet, that starts the user's own. */
  const update = (fn: (w: Workspace) => Partial<Workspace>, target: Mode = mode ?? "mine") => {
    setSpaces((prev) => ({ ...prev, [target]: { ...prev[target], ...fn(prev[target]) } }));
    if (!mode) setMode(target);
  };

  const loadDemo = () => {
    setSpaces((prev) => ({ ...prev, demo: demoWorkspace() }));
    setMode("demo");
  };

  useEffect(() => {
    // brief delay so skeletons are visible while "syncing"
    const t = setTimeout(() => {
      const saved = readSaved();
      if (saved) {
        setSpaces((prev) => ({ ...prev, mine: saved.workspace }));
        setRules(saved.rules);
      }
      const last = readMode();
      if (last === "demo") loadDemo();
      else if (last === "mine" || saved?.workspace.transactions.length) setMode("mine");
      setHydrated(true);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (mode) localStorage.setItem(MODE_KEY, mode);
      else localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(LEGACY_DEMO_KEY);
      localStorage.setItem(DATA_KEY, JSON.stringify({ ...spaces.mine, rules }));
    } catch {
      // Storage full or blocked: the session still works, it just won't survive a reload.
    }
  }, [hydrated, mode, spaces.mine, rules]);

  const learn = (merchant: string, category: Category) => {
    const key = merchantKey(merchant);
    if (!key || rules[key] === category) return false;
    setRules((prev) => ({ ...prev, [key]: category }));
    return true;
  };

  const value: Ctx = {
    hydrated,
    mode,
    hasOwnData: spaces.mine.transactions.length > 0 || spaces.mine.goals.length > 0,
    transactions,
    subscriptions,
    goals,
    income,
    incomeAssumed,
    setIncome: (v) => update(() => ({ income: v, incomeAssumed: false })),
    assumeSampleIncome: () =>
      setSpaces((prev) =>
        prev.mine.income !== null && !prev.mine.incomeAssumed
          ? prev
          : { ...prev, mine: { ...prev.mine, income: MONTHLY_INCOME, incomeAssumed: true } },
      ),
    ownIncomeSet: spaces.mine.income !== null && !spaces.mine.incomeAssumed,
    incomePrompt,
    askIncome: (suggested = null) => setIncomePrompt({ suggested }),
    closeIncomePrompt: () => setIncomePrompt(null),
    addGoal: (g) => update((w) => ({ goals: [...w.goals, { ...g, id: crypto.randomUUID() }] })),
    updateGoal: (id, patch) =>
      update((w) => ({ goals: w.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    removeGoal: (id) => update((w) => ({ goals: w.goals.filter((g) => g.id !== id) })),
    rules,
    add: (t) =>
      update((w) => ({ transactions: [{ ...t, id: crypto.randomUUID() }, ...w.transactions] })),
    addMany: (txs) => {
      const rows = txs.map((t) => ({ ...t, id: crypto.randomUUID() }));
      update(
        (w) => ({
          transactions: [...rows, ...w.transactions].sort((a, b) => b.date.localeCompare(a.date)),
        }),
        "mine",
      );
      setMode("mine");
      return mode === "demo";
    },
    learn,
    recategorize: (id, category) => {
      const t = transactions.find((x) => x.id === id);
      if (t) learn(t.merchant, category);
      update((w) => ({
        transactions: w.transactions.map((t) =>
          t.id === id ? { ...t, category, suggestedCategory: undefined } : t,
        ),
      }));
    },
    cancelSub: (key) => update((w) => ({ cancelled: [...w.cancelled, key] })),
    markUsed: (key) => update((w) => ({ usage: { ...w.usage, [key]: new Date().toISOString() } })),
    markUnused: (key) => update((w) => ({ usage: { ...w.usage, [key]: null } })),
    loadDemo,
    showMine: () => setMode("mine"),
    reset: () => {
      if (mode === "demo") {
        setSpaces((prev) => ({ ...prev, demo: emptyWorkspace() }));
        setMode(spaces.mine.transactions.length > 0 ? "mine" : null);
      } else {
        setSpaces((prev) => ({ ...prev, mine: emptyWorkspace() }));
        setRules({});
        setMode(null);
      }
    },
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

function readMode(): Mode | null {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "demo" || m === "mine") return m;
    return localStorage.getItem(LEGACY_DEMO_KEY) ? "demo" : null;
  } catch {
    return null;
  }
}

/** Ids the demo uses, so demo rows saved by older versions can be left out of the user's data. */
const DEMO_IDS = new Set([...DEMO_ALL_TX.map((t) => t.id), "g1", "g2", "g3"]);

function readSaved(): { workspace: Workspace; rules: Rules } | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Workspace> & { rules?: Rules };
    if (!Array.isArray(s.transactions)) return null;
    return {
      workspace: {
        transactions: s.transactions.filter((t) => !DEMO_IDS.has(t.id)),
        usage: s.usage ?? {},
        cancelled: s.cancelled ?? [],
        goals: (s.goals ?? []).map(toGoalInput).filter((g) => !DEMO_IDS.has(g.id)),
        // Before income was asked for, everyone silently got the stand-in; treat that as unknown.
        income:
          typeof s.income === "number" &&
          (s.incomeAssumed !== undefined || s.income !== MONTHLY_INCOME)
            ? s.income
            : null,
        incomeAssumed: s.incomeAssumed ?? false,
      },
      rules: s.rules ?? {},
    };
  } catch {
    return null;
  }
}

/** Accepts goals saved before due dates were "2027-03" and monthly amounts existed. */
function toGoalInput(g: Partial<GoalInput>): GoalInput {
  const due = /^\d{4}-\d{2}$/.test(g.due ?? "")
    ? g.due!
    : (() => {
        const d = new Date(`1 ${g.due}`);
        return isNaN(d.getTime()) ? monthFrom(new Date(), 12) : monthFrom(d, 0);
      })();
  return {
    id: g.id ?? crypto.randomUUID(),
    name: g.name ?? "Goal",
    saved: g.saved ?? 0,
    target: g.target ?? 0,
    due,
    monthly: g.monthly ?? 0,
  };
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
