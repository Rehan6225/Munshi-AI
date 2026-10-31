import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { ImportDialog } from "@/components/import-dialog";
import { AddIncomeButton } from "@/components/income-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEMO_EATING_OUT, useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { buildMonthReport, monthLabel, monthsWithData } from "@/lib/report";
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

const SUBTITLE = "A calm look back at where your money went.";
const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

function Page() {
  const { hydrated, transactions, loadDemo } = useStore();
  if (!hydrated) {
    return (
      <>
        <PageHeader title="Monthly Review" subtitle={SUBTITLE} />
        <Skeleton className="h-80 rounded-2xl" />
      </>
    );
  }
  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Monthly Review" subtitle={SUBTITLE} />
        <EmptyState
          icon={CalendarCheck}
          title="Your first review is on its way"
          text="Import a statement or log a few weeks of spending and we'll show trends here."
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
  return <Review />;
}

function Review() {
  const { transactions, subscriptions, goals, income, incomeAssumed, mode } = useStore();
  const months = useMemo(() => monthsWithData(transactions), [transactions]);
  const [month, setMonth] = useState(months[0]!);
  const report = useMemo(
    () => buildMonthReport({ transactions, subscriptions, goals, income }, month),
    [transactions, subscriptions, goals, income, month],
  );
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      await downloadReportPdf(report, {
        demo: mode === "demo",
        incomeNote:
          incomeAssumed && report.income !== null
            ? `Income of Rs ${report.income.toLocaleString("en-IN")} a month is assumed for the ${mode === "demo" ? "demo" : "sample data"}.`
            : null,
      });
      toast.success(`${report.label} report downloaded`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create the report. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const maxCat = Math.max(...report.categories.map((c) => c.amount), 1);
  const eoFirst = DEMO_EATING_OUT[0]!.amount;
  const eoLast = DEMO_EATING_OUT.at(-1)!.amount;

  return (
    <>
      <PageHeader
        title="Monthly Review"
        subtitle={SUBTITLE}
        action={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {months.length > 1 && (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-9 w-auto gap-2 rounded-xl bg-card text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              onClick={() => void download()}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span className="hidden sm:inline">Download report</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Income"
          value={report.income === null ? "Not set" : formatINR(report.income)}
          hint={report.income === null ? <AddIncomeButton className="mt-1" /> : undefined}
        />
        <Tile label="Spent" value={formatINR(report.spent)} hint={`${report.count} payments`} />
        {report.saved === null || report.savingsRate === null ? (
          <>
            <Tile label="Saved" value="—" hint="Needs your income" />
            <Tile label="Savings rate" value="—" hint="Needs your income" />
          </>
        ) : (
          <>
            <Tile
              label={report.saved >= 0 ? "Saved" : "Overspent"}
              value={formatINR(Math.abs(report.saved))}
              tone={report.saved >= 0 ? "text-primary" : "text-destructive"}
            />
            <Tile
              label="Savings rate"
              value={`${report.savingsRate}%`}
              tone={report.savingsRate >= 20 ? "text-primary" : "text-amber-400"}
            />
          </>
        )}
      </div>

      {report.highlights.length > 0 && (
        <section className="card-soft mt-5 p-6">
          <h2 className="font-semibold">Worth a look</h2>
          <ul className="mt-3 space-y-2.5">
            {report.highlights.map((h) => (
              <li key={h.text} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className={cn(
                    "mt-2 size-2 shrink-0 rounded-full",
                    h.tone === "good"
                      ? "bg-primary"
                      : h.tone === "warn"
                        ? "bg-amber-400"
                        : "bg-sky-400",
                  )}
                />
                {h.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card-soft p-6">
          <h2 className="font-semibold">Where your money went</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{report.label}</p>
          <ul className="mt-5 space-y-3.5">
            {report.categories.map((c, i) => (
              <li key={c.category}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="tabular-nums">
                    <b className="font-medium">{formatINR(c.amount)}</b>{" "}
                    <span className="text-muted-foreground">{Math.round(c.share * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(c.amount / maxCat) * 100}%`,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-soft p-6">
          <h2 className="font-semibold">Six months of spending</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Total spent each month</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trend}>
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
                <Bar dataKey="amount" radius={[8, 8, 8, 8]}>
                  {report.trend.map((t) => (
                    <Cell
                      key={t.month}
                      fill={t.month === month ? "var(--primary)" : "var(--chart-3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {report.changes.length > 0 && report.previousLabel && (
        <section className="card-soft mt-5 p-6">
          <h2 className="font-semibold">Compared with {report.previousLabel}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">This month</th>
                  <th className="py-2 text-right font-medium">Last month</th>
                  <th className="py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.changes.map((c) => (
                  <tr key={c.category}>
                    <td className="py-2.5">{c.category}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatINR(c.now)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatINR(c.before)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-medium tabular-nums",
                        c.diff > 0
                          ? "text-destructive"
                          : c.diff < 0
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.diff > 0 ? (
                          <ArrowUpRight className="size-3.5" />
                        ) : c.diff < 0 ? (
                          <ArrowDownRight className="size-3.5" />
                        ) : null}
                        {formatINR(Math.abs(c.diff))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mode === "demo" && (
        <section className="card-soft mt-5 p-6">
          <h2 className="font-semibold">Eating out is trending up</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatINR(eoFirst)} in May → {formatINR(eoLast)} in October (+
            {Math.round(((eoLast - eoFirst) / eoFirst) * 100)}%).
          </p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_EATING_OUT}>
                <XAxis
                  dataKey="month"
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
                <Bar dataKey="amount" fill="var(--primary)" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card-soft p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
