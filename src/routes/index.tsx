import { createFileRoute, Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Lightbulb, TrendingDown, Repeat, PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { PROFILE, useStore } from "@/lib/store";
import { formatINR, formatINRShort } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { TxList } from "@/components/tx-list";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pesa Pilot" },
      { name: "description", content: "Your month at a glance: spend, savings rate, emergency fund and goals in ₹." },
      { property: "og:title", content: "Dashboard — Pesa Pilot" },
      { property: "og:description", content: "Your month at a glance: spend, savings rate, emergency fund and goals in ₹." },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)", "var(--secondary)"];

function Dashboard() {
  const { transactions } = useStore();
  const now = new Date();
  const month = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const spend = month.reduce((s, t) => s + t.amount, 0);
  const savingsRate = Math.max(0, Math.round(((PROFILE.monthlyIncome - spend) / PROFILE.monthlyIncome) * 100));
  const ef = PROFILE.emergencyFund;
  const efPct = Math.round((ef.saved / ef.target) * 100);
  const goal = PROFILE.goals[0];
  const goalPct = Math.round((goal.saved / goal.target) * 100);

  const byCat = Object.entries(
    month.reduce<Record<string, number>>((acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + t.amount), acc), {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const food = byCat.find((c) => c.name === "Food")?.value ?? 0;
  const nudges = [
    { icon: TrendingDown, text: `Food delivery is at ${formatINR(food)} this month. Cooking twice a week could save ~${formatINR(food * 0.3)}.` },
    { icon: Repeat, text: "Cult.fit renews on 18 Nov — you checked in only twice last month." },
    { icon: PiggyBank, text: `Move ${formatINR(5000)} to your emergency fund to hit ${efPct + 2}% this week.` },
  ];

  return (
    <>
      <PageHeader title="Namaste 👋" subtitle={now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="This month's spend" value={formatINR(spend)} hint={`of ${formatINRShort(PROFILE.monthlyIncome)} income`} />
        <Stat label="Savings rate" value={`${savingsRate}%`} hint="Target 30%" accent={savingsRate >= 30} />
        <div className="card-soft p-6">
          <p className="text-sm text-muted-foreground">Emergency fund</p>
          <p className="mt-2 text-2xl font-semibold">{formatINRShort(ef.saved)}</p>
          <Progress value={efPct} className="mt-4 h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">{efPct}% of {formatINRShort(ef.target)}</p>
        </div>
        <Link to="/goals" className="card-soft p-6 transition hover:shadow-glow">
          <p className="text-sm text-muted-foreground">Next goal</p>
          <p className="mt-2 text-2xl font-semibold">{goal.name}</p>
          <Progress value={goalPct} className="mt-4 h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {formatINR(goal.saved)} / {formatINR(goal.target)} · {goal.due}
          </p>
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <section className="card-soft p-6 lg:col-span-3">
          <h2 className="font-semibold">Spending by category</h2>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-56 w-56 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCat} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={3} stroke="none">
                    {byCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
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
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatINR(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card-soft p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-primary" /> Nudges
          </h2>
          <ul className="mt-4 space-y-3">
            {nudges.map((n, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed">
                <n.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                {n.text}
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

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="card-soft p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

