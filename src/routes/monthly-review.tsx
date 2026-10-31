import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  Download,
  Lightbulb,
  Trophy,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_INFO, isFixed, isSaving } from "@/lib/categories";
import { formatINR, formatINRShort } from "@/lib/format";
import { buildReview, monthKey, monthLabel, monthsWithData } from "@/lib/review";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/monthly-review")({
  head: () => ({
    meta: [
      { title: "Monthly Review — Munshi AI" },
      { name: "description", content: "A calm look back at where your money went this month." },
      { property: "og:title", content: "Monthly Review — Munshi AI" },
      {
        property: "og:description",
        content: "A calm look back at where your money went this month.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, transactions, profile, subscriptions, goals } = useStore();
  const months = monthsWithData(transactions);
  const [picked, setPicked] = useState<string | null>(null);

  if (!hydrated) return <Skeleton className="h-96 rounded-2xl" />;
  if (!months.length)
    return (
      <>
        <PageHeader title="Monthly Review" />
        <EmptyState
          icon={CalendarCheck}
          title="Your first review is on its way"
          text="Log a few spends and Munshi will put together your monthly report card here."
        />
      </>
    );

  const month =
    picked && months.includes(picked)
      ? picked
      : (months.find((m) => m <= monthKey(new Date())) ?? months[0]!);
  const r = buildReview({ transactions, month, income: profile.income, subscriptions, goals });
  const changed = subscriptions.filter((s) => s.alerts.length);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Monthly Review</h1>
          <p className="mt-1.5 text-muted-foreground">Your report card for {r.label}.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={month}
            onChange={(e) => setPicked(e.target.value)}
            aria-label="Month"
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m} className="bg-popover">
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-medium transition hover:bg-secondary/70"
          >
            <Download className="size-4" /> Save as PDF
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Income"
          value={profile.income ? formatINR(r.income) : "—"}
          hint="from Money profile"
        />
        <Stat
          label="Spent"
          value={formatINR(r.spent)}
          hint={
            r.change === null ? (
              "no data for the month before"
            ) : (
              <Change
                value={r.change}
                suffix={` vs ${formatINRShort(r.previousSpent)} last month`}
              />
            )
          }
        />
        <Stat label="Invested" value={formatINR(r.invested)} hint="SIPs and other investments" />
        <Stat
          label="Saved"
          value={profile.income ? formatINR(r.saved) : "—"}
          hint={
            r.savingsRate === null ? "add income to see this" : `${r.savingsRate}% savings rate`
          }
          accent={r.savingsRate !== null && r.savingsRate >= 30}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <List
          icon={<Trophy className="size-4 text-primary" />}
          title="Wins"
          items={r.wins}
          empty="Keep logging; wins show up here."
        />
        <List
          icon={<Lightbulb className="size-4 text-primary" />}
          title="Suggestions"
          items={r.suggestions}
          empty="Nothing to fix this month. Nice!"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <section className="card-soft min-w-0 p-6 lg:col-span-3">
          <h2 className="font-semibold">Where it went</h2>
          <ul className="mt-4 divide-y divide-border">
            {r.categories
              .filter((c) => c.amount > 0 || c.previous > 0)
              .map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {CATEGORY_INFO[c.category].emoji} {c.category}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {c.change !== null && c.change !== 0 && (
                      // Going up is bad for flexible spends; bills moving is neutral.
                      <Change
                        value={c.change}
                        neutral={isFixed(c.category) || isSaving(c.category)}
                      />
                    )}
                    <span className="w-24 text-right font-medium tabular-nums">
                      {formatINR(c.amount)}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>

        <section className="card-soft min-w-0 p-6 lg:col-span-2">
          <h2 className="font-semibold">Last 6 months</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total spending, not counting investments.
          </p>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.trend}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                />
                <Bar dataKey="spent" radius={[8, 8, 8, 8]}>
                  {r.trend.map((t) => (
                    <Cell
                      key={t.month}
                      fill={t.month === month ? "var(--primary)" : "var(--secondary)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card-soft p-6">
          <h2 className="font-semibold">Goals</h2>
          {goals.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No goals yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {goals.map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{g.name}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <Progress value={g.pct} className="mt-2 h-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatINR(g.saved)} of {formatINR(g.target)} · {g.pct}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-soft p-6">
          <h2 className="font-semibold">Subscription changes</h2>
          {changed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No changes. Everything renewed as usual.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {changed.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {s.alerts
                      .map((a) =>
                        a === "price-up" && s.previousAmount
                          ? `price up ${formatINR(s.previousAmount)} → ${formatINR(s.amount)}`
                          : a === "price-down" && s.previousAmount
                            ? `price down ${formatINR(s.previousAmount)} → ${formatINR(s.amount)}`
                            : a === "unused"
                              ? "not being used"
                              : "new this month",
                      )
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", accent && "text-primary")}>
        {value}
      </p>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

/** ↑12% in red (spending more), ↓8% in green; `neutral` for bills, where neither is good or bad. */
function Change({
  value,
  suffix = "",
  neutral,
}: {
  value: number;
  suffix?: string;
  neutral?: boolean;
}) {
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums",
        neutral ? "text-muted-foreground" : up ? "text-destructive" : "text-primary",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(value)}%{suffix}
    </span>
  );
}

function List({
  icon,
  title,
  items,
  empty,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="card-soft p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((t) => (
            <li key={t} className="rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
