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
import type { ImportSource } from "./importers/rows";
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
  /** Set on rows brought in from a statement, CSV or SMS. */
  source?: ImportSource | undefined;
  /** The bank marked it as autopay (SI, mandate, ACH), so it repeats even if seen once. */
  recurring?: boolean | undefined;
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

const DEMO_ALL_TX = [...DEMO_TX, ...DEMO_RECURRING].sort((a, b) => b.date.localeCompare(a.date));

const DEMO_PROFILE: Profile = { income: 120000, emergencyMonths: 6, extraFixedCosts: [] };

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

/** The salary the sample files assume. The demo uses its own profile; real data asks. */
export const SAMPLE_INCOME = 95000;

/** One set of money data. The demo and the user's own numbers are kept apart. */
interface Workspace {
  transactions: Transaction[];
  usage: Usage;
  cancelled: string[];
  profile: Profile;
  goals: Goal[];
  rules: Rule[];
  /** The salary is a stand-in (demo or sample data), not something the user entered. */
  incomeAssumed: boolean;
}

/** What survives a refresh: both data sets, kept apart, and which one was on screen. */
interface Saved {
  mode: Mode | null;
  own: Workspace;
  /** Absent until the demo has been opened. */
  demo?: Workspace | undefined;
}

const KEY = "munshi-ai:v2";
/** Before the demo and own data were kept apart, one set was saved here. */
const LEGACY_KEY = "munshi-ai:v1";

const emptyWorkspace = (): Workspace => ({
  transactions: [],
  usage: {},
  cancelled: [],
  profile: EMPTY_PROFILE,
  goals: EMPTY_GOALS,
  rules: [],
  incomeAssumed: false,
});
const demoWorkspace = (): Workspace => ({
  transactions: DEMO_ALL_TX,
  usage: DEMO_USAGE,
  cancelled: [],
  profile: DEMO_PROFILE,
  goals: DEMO_GOALS,
  rules: [],
  incomeAssumed: true,
});

/** Fills gaps and renames old categories in data saved by earlier versions. */
function cleanWorkspace(w: Partial<Workspace> | undefined): Workspace {
  const base = { ...emptyWorkspace(), ...w };
  return {
    ...base,
    profile: { ...EMPTY_PROFILE, ...base.profile },
    // Data saved before the 18 categories used names like "Food" and "Bills".
    transactions: base.transactions.map((t) => ({ ...t, category: migrateCategory(t.category) })),
    rules: base.rules.map((r) => ({ ...r, category: migrateCategory(r.category) })),
  };
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      return {
        mode: s.mode ?? null,
        own: cleanWorkspace(s.own),
        demo: s.demo ? cleanWorkspace(s.demo) : undefined,
      };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const { mode, ...data } = JSON.parse(legacy) as Partial<Workspace> & { mode?: Mode | null };
      // The old format held either the demo or the user's data, never both.
      return mode === "demo"
        ? { mode, own: emptyWorkspace(), demo: cleanWorkspace(data) }
        : { mode: mode ?? null, own: mode === "own" ? cleanWorkspace(data) : emptyWorkspace() };
    }
  } catch {
    // Unreadable data: start fresh rather than crash.
  }
  return { mode: null, own: emptyWorkspace() };
}

interface Ctx {
  hydrated: boolean;
  /** null until the user picks demo data or their own numbers. */
  mode: Mode | null;
  /** True when the user has data of their own, whatever is on screen. */
  hasOwnData: boolean;
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
  /** Rules in the user's own data; imports use these even when the demo is on screen. */
  ownRules: Rule[];
  /** Transaction id → the category its merchant is usually filed under. */
  suggestions: Map<string, Category>;
  /** True when the salary on screen is the demo's or sample's stand-in. */
  incomeAssumed: boolean;
  /** True once the user has told us their own salary. */
  ownIncomeSet: boolean;
  /** Uses the sample files' salary for the user's data, unless they already gave theirs. */
  assumeSampleIncome: () => void;
  /** Set while the "what's your monthly salary?" dialog should be open. */
  incomePrompt: { suggested: number | null } | null;
  askIncome: (suggested?: number | null) => void;
  closeIncomePrompt: () => void;
  /** Adds a transaction, letting a learned rule override its category. */
  add: (t: Omit<Transaction, "id">) => Transaction;
  /**
   * Adds imported rows to the user's own data, never the demo.
   * Returns true when that meant switching away from the demo.
   */
  addMany: (txs: Omit<Transaction, "id">[]) => boolean;
  recategorize: (id: string, category: Category) => void;
  /**
   * Saves "merchant → category" and refiles past transactions. Returns how many changed.
   * `target` picks the data set; imports always teach the user's own.
   */
  learnRule: (merchant: string, category: Category, target?: Mode) => number;
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
  /** Shows a fresh copy of the demo. The user's own data is untouched. */
  loadDemo: () => void;
  /** Switches to the user's own data, starting it if there's none yet. */
  startOwn: () => void;
  /** Leaves the demo, or deletes the user's own data when that's on screen. */
  reset: () => void;
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [spaces, setSpaces] = useState<Record<Mode, Workspace>>(() => ({
    demo: emptyWorkspace(),
    own: emptyWorkspace(),
  }));
  const [incomePrompt, setIncomePrompt] = useState<Ctx["incomePrompt"]>(null);
  // Actions fired later (e.g. from a toast button) must see current data, not the render they came from.
  const latest = useRef({ mode, spaces });
  latest.current = { mode, spaces };

  /** Changes one data set; by default the one on screen, starting the user's own if none is. */
  const set = (fn: (w: Workspace) => Partial<Workspace>, target?: Mode) => {
    const where = target ?? latest.current.mode ?? "own";
    setSpaces((prev) => ({ ...prev, [where]: { ...prev[where], ...fn(prev[where]) } }));
    if (!latest.current.mode && !target) setMode("own");
  };

  useEffect(() => {
    // brief delay so skeletons are visible while "syncing"
    const t = setTimeout(() => {
      const saved = load();
      setSpaces({
        own: saved.own,
        demo: saved.demo ?? (saved.mode === "demo" ? demoWorkspace() : emptyWorkspace()),
      });
      setMode(saved.mode);
      setHydrated(true);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const demo = spaces.demo.transactions.length ? spaces.demo : undefined;
      localStorage.setItem(KEY, JSON.stringify({ mode, own: spaces.own, demo } satisfies Saved));
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Private mode or full storage: the app still works for this session.
    }
  }, [hydrated, mode, spaces]);

  const active = spaces[mode ?? "own"];
  const { transactions, usage, cancelled, profile } = active;
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
      planGoals(active.goals, {
        income: profile.income,
        spend,
        invested,
        fixed: fixed.total,
        emergencyMonths: profile.emergencyMonths,
      }),
    [active.goals, profile, spend, invested, fixed.total],
  );
  const now = () => latest.current.spaces[latest.current.mode ?? "own"];

  const value: Ctx = {
    hydrated,
    mode,
    hasOwnData: spaces.own.transactions.length > 0,
    transactions,
    subscriptions,
    profile,
    goals,
    spend,
    invested,
    fixed,
    rules: active.rules,
    ownRules: spaces.own.rules,
    suggestions,
    incomeAssumed: active.incomeAssumed,
    ownIncomeSet: spaces.own.profile.income > 0 && !spaces.own.incomeAssumed,
    assumeSampleIncome: () =>
      set(
        (w) =>
          w.profile.income > 0 && !w.incomeAssumed
            ? {}
            : { profile: { ...w.profile, income: SAMPLE_INCOME }, incomeAssumed: true },
        "own",
      ),
    incomePrompt,
    askIncome: (suggested = null) => setIncomePrompt({ suggested }),
    closeIncomePrompt: () => setIncomePrompt(null),
    add: (t) => {
      const rule = findRule(t.merchant, now().rules);
      const tx: Transaction = rule
        ? { ...t, id: crypto.randomUUID(), category: rule.category, ruleId: rule.id }
        : { ...t, id: crypto.randomUUID() };
      set((w) => ({
        transactions: [tx, ...w.transactions],
        rules: rule
          ? w.rules.map((r) => (r.id === rule.id ? { ...r, applied: r.applied + 1 } : r))
          : w.rules,
      }));
      return tx;
    },
    addMany: (txs) => {
      const rows = txs.map((t) => ({ ...t, id: crypto.randomUUID() }));
      set(
        (w) => ({
          transactions: [...rows, ...w.transactions].sort((a, b) => b.date.localeCompare(a.date)),
        }),
        "own",
      );
      const leftDemo = latest.current.mode === "demo";
      setMode("own");
      return leftDemo;
    },
    recategorize: (id, category) =>
      set((w) => ({
        transactions: w.transactions.map((t) =>
          t.id === id ? { ...t, category, ruleId: undefined } : t,
        ),
      })),
    learnRule: (merchant, category, target) => {
      const where = target ?? latest.current.mode ?? "own";
      const w = latest.current.spaces[where];
      const key = merchantKey(merchant);
      const existing = w.rules.find((r) => r.key === key);
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
      const matching = w.transactions.filter((t) => merchantKey(t.merchant) === key);
      const changed = matching.filter((t) => t.category !== category).length;
      set(
        (w) => ({
          transactions: w.transactions.map((t) =>
            merchantKey(t.merchant) === key ? { ...t, category, ruleId: rule.id } : t,
          ),
          rules: [
            ...w.rules.filter((r) => r.key !== key),
            { ...rule, applied: existing ? existing.applied + changed : matching.length },
          ],
        }),
        where,
      );
      return changed;
    },
    removeRule: (id) =>
      set((w) => ({
        rules: w.rules.filter((r) => r.id !== id),
        transactions: w.transactions.map((t) =>
          t.ruleId === id ? { ...t, ruleId: undefined } : t,
        ),
      })),
    cancelSub: (key) => set((w) => ({ cancelled: [...w.cancelled, key] })),
    markUsed: (key) => set((w) => ({ usage: { ...w.usage, [key]: new Date().toISOString() } })),
    markUnused: (key) => set((w) => ({ usage: { ...w.usage, [key]: null } })),
    updateProfile: (patch) =>
      set((w) => ({
        profile: { ...w.profile, ...patch },
        // A salary the user types in is theirs, not a stand-in.
        ...("income" in patch && { incomeAssumed: false }),
      })),
    addFixedCost: () =>
      set((w) => ({
        profile: {
          ...w.profile,
          extraFixedCosts: [
            ...w.profile.extraFixedCosts,
            { id: crypto.randomUUID(), name: "", amount: 0 },
          ],
        },
      })),
    updateFixedCost: (id, patch) =>
      set((w) => ({
        profile: {
          ...w.profile,
          extraFixedCosts: w.profile.extraFixedCosts.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        },
      })),
    removeFixedCost: (id) =>
      set((w) => ({
        profile: {
          ...w.profile,
          extraFixedCosts: w.profile.extraFixedCosts.filter((c) => c.id !== id),
        },
      })),
    saveGoal: (goal) => set((w) => ({ goals: w.goals.map((g) => (g.id === goal.id ? goal : g)) })),
    addGoal: () =>
      set((w) => ({
        goals: [
          ...w.goals,
          {
            id: crypto.randomUUID(),
            name: "New goal",
            target: 50000,
            saved: 0,
            due: monthsFromNow(6),
          },
        ],
      })),
    removeGoal: (id) => set((w) => ({ goals: w.goals.filter((g) => g.id !== id) })),
    loadDemo: () => {
      setSpaces((prev) => ({ ...prev, demo: demoWorkspace() }));
      setMode("demo");
    },
    startOwn: () => setMode("own"),
    reset: () => {
      if (mode === "demo") {
        setSpaces((prev) => ({ ...prev, demo: emptyWorkspace() }));
        setMode(spaces.own.transactions.length > 0 ? "own" : null);
      } else {
        setSpaces((prev) => ({ ...prev, own: emptyWorkspace() }));
        setMode(null);
      }
    },
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
