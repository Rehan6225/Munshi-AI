import { createFileRoute, Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Lightbulb, TrendingUp, Repeat, ShieldAlert, Tag, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { DEMO_EATING_OUT, useStore } from "@/lib/store";
import { daysSince, yearlyCost } from "@/lib/recurring";
import { formatINR, formatINRShort } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TxList } from "@/components/tx-list";
import { CardSkeletons, EmptyState, ListSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { AddIncomeButton } from "@/components/income-dialog";
import type { ReactNode } from "react";

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

function Dashboard() {
  const { hydrated, transactions, subscriptions, goals, income } = useStore();
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

  const month = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const spend = month.reduce((s, t) => s + t.amount, 0);
  const savingsRate =
    income === null ? null : Math.max(0, Math.round(((income - spend) / income) * 100));
  const ef = goals.find((g) => g.name === "Emergency fund");
  const efPct = ef ? Math.round((ef.saved / ef.target) * 100) : 0;
  const goal = goals.find((g) => g !== ef);
  const goalPct = goal ? Math.round((goal.saved / goal.target) * 100) : 0;

  const byCat = Object.entries(
    month.reduce<Record<string, number>>(
      (acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + t.amount), acc),
      {},
    ),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const unused = subscriptions.find((s) => s.alerts.includes("unused"));
  const hike = subscriptions.find((s) => s.alerts.includes("price-up"));
  const fresh = subscriptions.find((s) => s.alerts.includes("new"));
  const renews = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const miscat = transactions.find((t) => t.suggestedCategory);
  const eo = DEMO_EATING_OUT;
  const eoFirst = eo[0]!.amount;
  const eoLast = eo[eo.length - 1]!.amount;
  const nudges = [
    {
      icon: TrendingUp,
      text: `Eating out is up ${Math.round(((eoLast - eoFirst) / eoFirst) * 100)}% since May — ${formatINR(eoLast)} this month.`,
      to: "/monthly-review" as const,
    },
    unused && {
      icon: Repeat,
      text: `${unused.name} renews ${renews(unused.next)}${unused.lastUsed ? `. You haven't used it in ${daysSince(unused.lastUsed)} days` : ", and you said you don't use it"}. Cancel to save ${formatINR(yearlyCost(unused))} a year.`,
      to: "/subscriptions" as const,
    },
    hike &&
      hike.previousAmount && {
        icon: Repeat,
        text: `${hike.name} went from ${formatINR(hike.previousAmount)} to ${formatINR(hike.amount)}. That's ${formatINR(yearlyCost({ ...hike, amount: hike.amount - hike.previousAmount }))} more a year.`,
        to: "/subscriptions" as const,
      },
    fresh && {
      icon: Repeat,
      text: `New autopay: ${fresh.name} at ${formatINR(fresh.amount)}/${fresh.cycle === "Yearly" ? "year" : "month"}. Did you mean to sign up?`,
      to: "/subscriptions" as const,
    },
    miscat && {
      icon: Tag,
      text: `A ${miscat.merchant} order was filed under ${miscat.category}. Fix it so your food spend is honest.`,
      to: "/transactions" as const,
    },
    ef?.status === "At risk" && {
      icon: ShieldAlert,
      text: `Emergency fund is at risk. ${ef.note}`,
      to: "/goals" as const,
    },
  ].filter(Boolean) as unknown as { icon: typeof Repeat; text: string; to: "/" }[];

  return (
    <>
      <PageHeader
        title="Namaste 👋"
        subtitle={now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="This month's spend"
          value={formatINR(spend)}
          hint={
            income === null ? "Add your income to compare" : `of ${formatINRShort(income)} income`
          }
        />
        <Stat
          label="Savings rate"
          value={savingsRate === null ? "—" : `${savingsRate}%`}
          hint={savingsRate === null ? <AddIncomeButton /> : "Target 30%"}
          accent={savingsRate !== null && savingsRate >= 30}
        />
        {ef && (
          <Link to="/goals" className="card-soft p-6 transition hover:shadow-glow">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Emergency fund</p>
              <StatusBadge status={ef.status} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatINRShort(ef.saved)}</p>
            <Progress value={efPct} className="mt-4 h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">
              {efPct}% of {formatINRShort(ef.target)}
            </p>
          </Link>
        )}
        {goal && (
          <Link to="/goals" className="card-soft p-6 transition hover:shadow-glow">
            <p className="text-sm text-muted-foreground">Next goal</p>
            <p className="mt-2 truncate text-2xl font-semibold">{goal.name}</p>
            <Progress value={goalPct} className="mt-4 h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatINR(goal.saved)} / {formatINR(goal.target)} · {goal.due}
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
            {nudges.map((n, i) => (
              <li key={i}>
                <Link
                  to={n.to}
                  className="flex gap-3 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed transition hover:bg-secondary animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <n.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {n.text}
                </Link>
              </li>
            ))}
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
  hint: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card-soft p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
