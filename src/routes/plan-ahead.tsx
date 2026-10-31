import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, RotateCcw, Sparkles, TrendingDown, TrendingUp, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, CardSkeletons } from "@/components/states";
import { ImportDialog } from "@/components/import-dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import {
  EMPTY_SCENARIO,
  buildBaseline,
  formatMonth,
  simulate,
  type Baseline,
  type Scenario,
} from "@/lib/plan";
import { useStore, type Category, type Goal } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan-ahead")({
  head: () => ({
    meta: [
      { title: "Plan Ahead — Munshi AI" },
      {
        name: "description",
        content: "Play out scenarios like a raise, a new EMI or cutting food delivery.",
      },
      { property: "og:title", content: "Plan Ahead — Munshi AI" },
      {
        property: "og:description",
        content: "Play out scenarios like a raise, a new EMI or cutting food delivery.",
      },
    ],
  }),
  component: Page,
});

const SUBTITLE = "Try a change and see what it does to your savings and goals.";

function Page() {
  const { hydrated, transactions, loadDemo, income, askIncome } = useStore();
  if (!hydrated) {
    return (
      <>
        <PageHeader title="Plan Ahead" subtitle={SUBTITLE} />
        <div className="grid gap-5 lg:grid-cols-5">
          <CardSkeletons count={2} className="h-64 lg:col-span-3" />
        </div>
      </>
    );
  }
  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Plan Ahead" subtitle={SUBTITLE} />
        <EmptyState
          icon={Wand2}
          title="Plan Ahead needs a month of spending"
          text="Import a bank statement or try the demo data, then play with cutting back, a raise or a new EMI."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ImportDialog>
                <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                  Import a statement
                </button>
              </ImportDialog>
              <button
                onClick={loadDemo}
                className="rounded-xl border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-primary/50"
              >
                Try with demo data
              </button>
            </div>
          }
        />
      </>
    );
  }
  if (income === null) {
    return (
      <>
        <PageHeader title="Plan Ahead" subtitle={SUBTITLE} />
        <EmptyState
          icon={Wand2}
          title="Plan Ahead needs your monthly salary"
          text="Everything here is worked out from what you earn and what you spend. Add your take-home pay to start."
          action={
            <button
              onClick={() => askIncome()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Add your monthly salary
            </button>
          }
        />
      </>
    );
  }
  return <Simulator income={income} />;
}

interface Idea {
  label: string;
  /** Amount box to jump to once the idea is switched on. */
  focus?: string;
  on: (s: Scenario) => boolean;
  toggle: (s: Scenario) => Scenario;
}

function Simulator({ income }: { income: number }) {
  const { transactions, subscriptions, goals, setIncome } = useStore();
  const base = useMemo(
    () => buildBaseline(income, transactions, subscriptions),
    [income, transactions, subscriptions],
  );
  const openGoals = goals.filter((g) => g.status !== "Reached");
  const [scenario, setScenario] = useState<Scenario>(() => ({
    ...EMPTY_SCENARIO,
    goalId: (openGoals.find((g) => g.status === "At risk") ?? openGoals[0])?.id ?? null,
  }));
  const out = simulate(base, scenario, goals);
  const set = (patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch }));
  const changed =
    scenario.incomeChange !== 0 ||
    Object.values(scenario.cuts).some(Boolean) ||
    scenario.cancel.length > 0 ||
    scenario.emi > 0 ||
    scenario.purchase > 0;

  const everyday = (Object.entries(base.everyday) as [Category, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const subs = base.recurring.filter((r) => r.kind === "subscription");
  const bills = base.recurring.filter((r) => r.kind === "bill");
  const unused = subscriptions
    .filter((s) => s.kind === "subscription" && s.alerts.includes("unused"))
    .map((s) => s.key);
  const topCategory = everyday[0]?.[0];

  const ideas: Idea[] = [
    topCategory && {
      label: `Spend half as much on ${topCategory}`,
      on: (s: Scenario) => s.cuts[topCategory] === 50,
      toggle: (s: Scenario) => ({
        ...s,
        cuts: { ...s.cuts, [topCategory]: s.cuts[topCategory] === 50 ? 0 : 50 },
      }),
    },
    unused.length > 0 && {
      label: `Cancel ${unused.length === 1 ? "the subscription you don't use" : `${unused.length} unused subscriptions`}`,
      on: (s: Scenario) => unused.every((k) => s.cancel.includes(k)),
      toggle: (s: Scenario) => ({
        ...s,
        cancel: unused.every((k) => s.cancel.includes(k))
          ? s.cancel.filter((k) => !unused.includes(k))
          : [...new Set([...s.cancel, ...unused])],
      }),
    },
    {
      label: "Get a 10% raise",
      on: (s: Scenario) => s.incomeChange === Math.round(income / 10 / 100) * 100,
      toggle: (s: Scenario) => ({
        ...s,
        incomeChange:
          s.incomeChange === Math.round(income / 10 / 100) * 100
            ? 0
            : Math.round(income / 10 / 100) * 100,
      }),
    },
    {
      // Starts from a typical figure, then puts the cursor in the box to type their own.
      label: "Add a car EMI",
      focus: "whatif-emi",
      on: (s: Scenario) => s.emi > 0,
      toggle: (s: Scenario) => ({ ...s, emi: s.emi > 0 ? 0 : 15000 }),
    },
    {
      label: "Plan a big purchase",
      focus: "whatif-purchase",
      on: (s: Scenario) => s.purchase > 0,
      toggle: (s: Scenario) => ({ ...s, purchase: s.purchase > 0 ? 0 : 80000 }),
    },
  ].filter(Boolean) as Idea[];

  return (
    <>
      <PageHeader
        title="Plan Ahead"
        subtitle={SUBTITLE}
        action={
          changed && (
            <button
              onClick={() => setScenario({ ...EMPTY_SCENARIO, goalId: scenario.goalId })}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-primary/50"
            >
              <RotateCcw className="size-4" />
              Start over
            </button>
          )
        }
      />

      <TodayStrip base={base} left={out.leftBefore} spend={out.spendBefore} onIncome={setIncome} />

      <section className="mt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Start with an idea
        </p>
        <div className="flex flex-wrap gap-2">
          {ideas.map((idea) => {
            const on = idea.on(scenario);
            return (
              <button
                key={idea.label}
                onClick={() => {
                  setScenario(idea.toggle(scenario));
                  if (!on && idea.focus) focusAmount(idea.focus);
                }}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                  on
                    ? "border-primary bg-accent text-accent-foreground"
                    : "bg-card hover:border-primary/50 hover:bg-accent/50",
                )}
              >
                <Sparkles
                  className={cn("size-3.5", on ? "text-primary" : "text-muted-foreground")}
                />
                {idea.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* On phones the result is below the levers, so keep the headline in view. */}
      <div className="sticky top-2 z-20 mt-5 lg:hidden">
        <Difference value={out.difference} compact />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Lever title="Income" hint="A raise, a bonus each month, or a pay cut.">
            <SliderRow
              label="Change per month"
              amountId="whatif-income"
              signed
              value={scenario.incomeChange}
              min={-Math.round(income / 2 / 1000) * 1000}
              max={Math.round(income / 2 / 1000) * 1000}
              step={500}
              onChange={(v) => set({ incomeChange: v })}
              display={
                scenario.incomeChange === 0
                  ? "No change"
                  : `${scenario.incomeChange > 0 ? "+" : "−"}${formatINR(Math.abs(scenario.incomeChange))}`
              }
            />
          </Lever>

          {everyday.length > 0 && (
            <Lever title="Everyday spending" hint="From your last 30 days. Slide to spend less.">
              {everyday.map(([cat, amount]) => {
                const cut = scenario.cuts[cat] ?? 0;
                return (
                  <SliderRow
                    key={cat}
                    label={cat}
                    sub={`${formatINR(amount)} a month`}
                    value={cut}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) => set({ cuts: { ...scenario.cuts, [cat]: v } })}
                    display={
                      cut === 0
                        ? "No change"
                        : `−${cut}% · saves ${formatINR((amount * cut) / 100)}`
                    }
                  />
                );
              })}
            </Lever>
          )}

          {(subs.length > 0 || bills.length > 0) && (
            <Lever title="Subscriptions" hint="Switch off the ones you'd cancel.">
              <ul className="divide-y divide-border">
                {subs.map((r) => {
                  const keep = !scenario.cancel.includes(r.key);
                  return (
                    <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
                      <label htmlFor={`keep-${r.key}`} className="min-w-0 cursor-pointer">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium",
                            !keep && "line-through opacity-60",
                          )}
                        >
                          {r.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {keep
                            ? `${formatINR(r.monthly)} a month`
                            : `Saves ${formatINR(r.monthly * 12)} a year`}
                        </span>
                      </label>
                      <Switch
                        id={`keep-${r.key}`}
                        checked={keep}
                        onCheckedChange={(v) =>
                          set({
                            cancel: v
                              ? scenario.cancel.filter((k) => k !== r.key)
                              : [...scenario.cancel, r.key],
                          })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
              {bills.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {bills.map((b) => b.name).join(", ")} (
                  {formatINR(bills.reduce((s, b) => s + b.monthly, 0))} a month) stay the same.
                </p>
              )}
            </Lever>
          )}

          <Lever title="New commitments" hint="Something you're thinking of taking on.">
            <SliderRow
              label="New EMI"
              sub="Car, phone or home loan · per month"
              amountId="whatif-emi"
              value={scenario.emi}
              min={0}
              max={50000}
              step={500}
              onChange={(v) => set({ emi: v })}
              display={scenario.emi ? `${formatINR(scenario.emi)} a month` : "None"}
            />
            <SliderRow
              label="One-time purchase"
              amountId="whatif-purchase"
              sub={
                out.goals.find((g) => g.goal.id === scenario.goalId)
                  ? `Paid from your ${goals.find((g) => g.id === scenario.goalId)!.name} savings`
                  : "Paid from your savings"
              }
              value={scenario.purchase}
              min={0}
              max={300000}
              step={5000}
              onChange={(v) => set({ purchase: v })}
              display={scenario.purchase ? formatINR(scenario.purchase) : "None"}
            />
          </Lever>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-2">
          <div className="card-soft p-6">
            <Difference value={out.difference} />
            <Bars before={out.leftBefore} after={out.leftAfter} />
            {out.leftAfter < 0 && (
              <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                You'd spend {formatINR(-out.leftAfter)} more than you earn each month.
              </p>
            )}
            <Changes base={base} scenario={scenario} goals={goals} />
          </div>

          <div className="card-soft p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Your goals</h3>
              {openGoals.length > 0 && (
                <Select value={scenario.goalId ?? ""} onValueChange={(v) => set({ goalId: v })}>
                  <SelectTrigger className="h-8 w-auto gap-2 rounded-lg bg-card text-xs">
                    <span className="text-muted-foreground">Difference goes to</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {openGoals.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {goals.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <Link to="/goals" className="font-medium text-primary hover:underline">
                  Add a goal
                </Link>{" "}
                to see how these changes move its finish date.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {out.goals.map(({ goal, before, after, shift }) => (
                  <li key={goal.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{goal.name}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {goal.status === "Reached" ? (
                          "Already reached"
                        ) : (
                          <>
                            {before ? formatMonth(before) : "Never at this pace"}
                            {shift !== 0 && (
                              <>
                                <ArrowRight className="size-3" />
                                <span className="text-foreground">
                                  {after ? formatMonth(after) : "Never"}
                                </span>
                              </>
                            )}
                            <span>· due {formatMonth(goal.due)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Shift shift={shift} before={before} after={after} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function TodayStrip({
  base,
  left,
  spend,
  onIncome,
}: {
  base: Baseline;
  left: number;
  spend: number;
  onIncome: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const v = Number((draft ?? "").replace(/[^\d]/g, ""));
    if (v > 0) onIncome(v);
    setDraft(null);
  };
  return (
    <div className="card-soft grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div className="p-5">
        <label htmlFor="income" className="text-xs text-muted-foreground">
          Monthly take-home pay
        </label>
        <div className="mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums">
          <span>₹</span>
          <input
            id="income"
            inputMode="numeric"
            value={draft ?? base.income.toLocaleString("en-IN")}
            onFocus={() => setDraft(String(base.income))}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full min-w-0 rounded-md bg-transparent outline-none ring-primary/40 focus:ring-2"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Tap to change</p>
      </div>
      <Stat label="Spent in the last 30 days" value={formatINR(spend)} />
      <Stat
        label="Left over each month"
        value={formatINR(left)}
        tone={left < 0 ? "text-destructive" : "text-primary"}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function Lever({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="card-soft p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function focusAmount(id: string) {
  // After the re-render that switched the idea on.
  setTimeout(() => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
    el?.select();
  }, 50);
}

function SliderRow({
  label,
  sub,
  value,
  min,
  max,
  step,
  onChange,
  display,
  amountId,
  signed,
}: {
  label: string;
  sub?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  /** Shows a ₹ box for typing an exact amount instead of the text label. */
  amountId?: string;
  /** Allows negative amounts, like a pay cut. */
  signed?: boolean;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={amountId} className="block truncate text-sm font-medium">
            {label}
          </label>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        {amountId ? (
          <AmountInput id={amountId} value={value} onChange={onChange} signed={signed} />
        ) : (
          <span
            className={cn(
              "shrink-0 text-right text-xs tabular-nums",
              value === 0 ? "text-muted-foreground" : "font-medium text-accent-foreground",
            )}
          >
            {display}
          </span>
        )}
      </div>
      <Slider
        value={[value]}
        // A typed amount can go past the usual range; stretch the slider to fit it.
        min={Math.min(min, value)}
        max={Math.max(max, value)}
        step={step}
        onValueChange={([v]) => onChange(v ?? 0)}
        aria-label={label}
      />
    </div>
  );
}

function Difference({ value, compact }: { value: number; compact?: boolean }) {
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const text =
    value === 0
      ? "Move a slider or tap an idea"
      : `${up ? "+" : "−"}${formatINR(Math.abs(value))} a month`;
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-2.5 text-sm shadow-soft backdrop-blur",
          value > 0 && "border-primary/40",
          value < 0 && "border-destructive/40",
        )}
      >
        <span className="text-muted-foreground">Left over each month</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            up ? "text-primary" : value < 0 && "text-destructive",
          )}
        >
          {text}
        </span>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">Compared with now, you'd have</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight tabular-nums",
          up && "text-primary",
          value < 0 && "text-destructive",
          value === 0 && "text-xl text-muted-foreground",
        )}
      >
        {value !== 0 && <Icon className="size-6" />}
        {text}
      </p>
      {value !== 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {up ? "That's" : "That costs"} {formatINR(Math.abs(value) * 12)} a year.
        </p>
      )}
    </div>
  );
}

function Bars({ before, after }: { before: number; after: number }) {
  const max = Math.max(1, Math.abs(before), Math.abs(after));
  const rows = [
    { label: "Now", value: before, tone: "bg-muted-foreground/40" },
    { label: "With changes", value: after, tone: after < 0 ? "bg-destructive" : "bg-primary" },
  ];
  return (
    <div className="mt-5 space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums">{formatINR(r.value)} left</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all duration-500", r.tone)}
              style={{ width: `${(Math.max(0, r.value) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The scenario in plain words, so it's clear what the number is made of. */
function Changes({ base, scenario, goals }: { base: Baseline; scenario: Scenario; goals: Goal[] }) {
  const goal = goals.find((g) => g.id === scenario.goalId);
  const lines: string[] = [];
  if (scenario.incomeChange) {
    lines.push(
      `Income ${scenario.incomeChange > 0 ? "up" : "down"} ${formatINR(Math.abs(scenario.incomeChange))} a month`,
    );
  }
  for (const [cat, pct] of Object.entries(scenario.cuts) as [Category, number][]) {
    if (pct)
      lines.push(
        `${pct}% less on ${cat}, saving ${formatINR(((base.everyday[cat] ?? 0) * pct) / 100)}`,
      );
  }
  for (const key of scenario.cancel) {
    const r = base.recurring.find((x) => x.key === key);
    if (r) lines.push(`Cancel ${r.name}, saving ${formatINR(r.monthly)}`);
  }
  if (scenario.emi) lines.push(`New EMI of ${formatINR(scenario.emi)} a month`);
  if (scenario.purchase) {
    lines.push(
      `${formatINR(scenario.purchase)} purchase from ${goal ? `${goal.name} savings` : "savings"}`,
    );
  }
  if (!lines.length) return null;
  return (
    <ul className="mt-5 space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
      {lines.map((l) => (
        <li key={l} className="flex gap-2">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
          {l}
        </li>
      ))}
    </ul>
  );
}

function Shift({
  shift,
  before,
  after,
}: {
  shift: number | null;
  before: string | null;
  after: string | null;
}) {
  if (shift === 0 || (before === null && after === null)) {
    return <span className="shrink-0 text-xs text-muted-foreground">No change</span>;
  }
  const sooner = shift === null ? after !== null : shift > 0;
  const label =
    shift === null
      ? sooner
        ? "Now reachable"
        : "Out of reach"
      : `${Math.abs(shift)} month${Math.abs(shift) > 1 ? "s" : ""} ${sooner ? "sooner" : "later"}`;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        sooner ? "bg-accent text-accent-foreground" : "bg-destructive/15 text-destructive",
      )}
    >
      {label}
    </span>
  );
}

/** A ₹ box that shows Indian digit grouping and updates the scenario as you type. */
function AmountInput({
  id,
  value,
  onChange,
  signed,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  signed?: boolean | undefined;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft ??
    (value === 0
      ? ""
      : `${signed && value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("en-IN")}`);
  return (
    <div className="relative w-36 shrink-0">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        ₹
      </span>
      <input
        id={id}
        inputMode={signed ? "text" : "numeric"}
        value={shown}
        placeholder={signed ? "+ or − amount" : "0"}
        onFocus={(e) => {
          setDraft(value === 0 ? "" : String(value));
          // Select after the box switches to plain digits, so typing replaces the old amount.
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        onChange={(e) => {
          const raw = e.target.value.replace(/−/g, "-");
          const negative = signed && raw.trim().startsWith("-");
          const digits = raw.replace(/[^\d]/g, "").slice(0, 9);
          setDraft(`${negative ? "-" : ""}${digits}`);
          onChange((negative ? -1 : 1) * (Number(digits) || 0));
        }}
        className={cn(
          "w-full rounded-lg border bg-card py-1.5 pl-6 pr-2.5 text-right text-sm tabular-nums outline-none transition focus:border-primary/60",
          value !== 0 && "border-primary/40 font-medium text-accent-foreground",
        )}
      />
    </div>
  );
}
