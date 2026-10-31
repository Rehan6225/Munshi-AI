import { createFileRoute, Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Lightbulb, TrendingUp, Repeat, ShieldAlert, Tag, Receipt, Wallet } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { MunshiAvatar } from "@/components/munshi";
import { dailySummary, type Line } from "@/lib/munshi";
import { speak, useSpeech } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { buildNudges, type NudgeKind } from "@/lib/nudges";
import { isSaving } from "@/lib/categories";
import { formatINR, formatINRShort } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TxList } from "@/components/tx-list";
import { CardSkeletons, EmptyState, ListSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Munshi AI" },
      {
        name: "description",
        content: "Your month at a glance: spend, savings rate, emergency fund and goals in ₹.",
      },
      { property: "og:title", content: "Dashboard — Munshi AI" },
      {
        property: "og:description",
        content: "Your month at a glance: spend, savings rate, emergency fund and goals in ₹.",
      },
    ],
  }),
  component: Dashboard,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
  "var(--secondary)",
];

const NUDGE_ICONS: Record<NudgeKind, typeof Repeat> = {
  drift: TrendingUp,
  budget: Wallet,
  subscription: Repeat,
  category: Tag,
  goal: ShieldAlert,
};

function Dashboard() {
  const { hydrated, transactions, subscriptions, goals, profile, suggestions } = useStore();
  const now = new Date();

  if (!hydrated) {
    return (
      <>
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeletons />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          <div className="card-soft h-80 lg:col-span-3" />
          <div className="card-soft h-80 p-6 lg:col-span-2">
            <ListSkeleton rows={3} />
          </div>
        </div>
      </>
    );
  }

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Namaste 👋" />
        <EmptyState
          icon={Receipt}
          title="Nothing logged yet"
          text="Type or dictate your first spend in the bar below — or load the demo to see Munshi AI in action."
        />
      </>
    );
  }

  // SIPs and other investments are saving, not spending.
  const month = transactions.filter((t) => {
    const d = new Date(t.date);
    return (
      !isSaving(t.category) &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });
  const spend = month.reduce((s, t) => s + t.amount, 0);
  const income = profile.income;
  const savingsRate =
    income > 0 ? Math.max(0, Math.round(((income - spend) / income) * 100)) : null;
  const ef = goals.find((g) => g.emergency);
  // The unfinished goal with the nearest deadline.
  const goal = goals
    .filter((g) => !g.emergency && g.status !== "Done")
    .sort((a, b) => a.due.localeCompare(b.due))[0];

  const byCat = Object.entries(
    month.reduce<Record<string, number>>(
      (acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + t.amount), acc),
      {},
    ),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const nudges = buildNudges({
    transactions,
    subscriptions,
    suggestions,
    goals,
    budgets: profile.budgets,
  });

  return (
    <>
      <MunshiGreeting
        date={now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        summary={dailySummary({ spend, income, topNudge: nudges[0]?.text })}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="This month's spend"
          value={formatINR(spend)}
          hint={
            income > 0 ? `of ${formatINRShort(income)} income` : "Add your income in Money profile"
          }
        />
        <Stat
          label="Savings rate"
          value={savingsRate === null ? "—" : `${savingsRate}%`}
          hint="Target 30%"
          accent={savingsRate !== null && savingsRate >= 30}
        />
        {ef && (
          <Link to="/goals" className="card-soft p-6 transition hover:shadow-glow">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Emergency fund</p>
              <StatusBadge status={ef.status} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatINRShort(ef.saved)}</p>
            <Progress value={ef.pct} className="mt-4 h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">
              {ef.pct}% of {formatINRShort(ef.target)}
            </p>
          </Link>
        )}
        {goal && (
          <Link to="/goals" className="card-soft p-6 transition hover:shadow-glow">
            <p className="text-sm text-muted-foreground">Next goal</p>
            <p className="mt-2 truncate text-2xl font-semibold">{goal.name}</p>
            <Progress value={goal.pct} className="mt-4 h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatINR(goal.saved)} / {formatINR(goal.target)} ·{" "}
              {new Date(goal.due).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </Link>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <section className="card-soft min-w-0 p-6 lg:col-span-3">
          <h2 className="font-semibold">Spending by category</h2>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative size-52 shrink-0 sm:size-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCat}
                    dataKey="value"
                    innerRadius="70%"
                    outerRadius="100%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {byCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatINRShort(spend)}</p>
                </div>
              </div>
            </div>
            <ul className="w-full space-y-2.5">
              {byCat.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatINR(c.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card-soft min-w-0 p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-primary" /> Nudges
            <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {nudges.length}
            </span>
          </h2>
          <ul className="mt-4 space-y-3">
            {nudges.map((n, i) => {
              const Icon = NUDGE_ICONS[n.kind];
              return (
                <li key={i}>
                  <Link
                    to={n.to}
                    className="flex gap-3 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed transition hover:bg-secondary animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {n.text}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card-soft mt-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link to="/transactions" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <TxList items={transactions.slice(0, 6)} />
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="card-soft p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MunshiGreeting({ date, summary }: { date: string; summary: Line }) {
  const [shown, setShown] = useState(false);
  const { supported } = useSpeech();
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
      <MunshiAvatar size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Namaste! Main hoon Munshi ji 🙏
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          {shown ? summary.text : `${date} · Aapka hisaab-kitaab main rakhta hoon.`}
        </p>
      </div>
      <button
        onClick={() => {
          setShown(true);
          speak(summary, { force: true });
        }}
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium transition hover:bg-secondary/70 sm:self-auto"
      >
        {supported ? "🔊 Suniye aaj ka hisaab" : "Aaj ka hisaab dekhiye"}
      </button>
    </div>
  );
}
