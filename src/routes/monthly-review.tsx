import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_EATING_OUT, useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/monthly-review")({
  head: () => ({
    meta: [
      { title: "Monthly Review — Munshi AI" },
      { name: "description", content: "A calm look back at where your money went this month." },
      { property: "og:title", content: "Monthly Review — Munshi AI" },
      { property: "og:description", content: "A calm look back at where your money went this month." },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, demo } = useStore();
  const first = DEMO_EATING_OUT[0]!.amount;
  const last = DEMO_EATING_OUT[DEMO_EATING_OUT.length - 1]!.amount;
  return (
    <>
      <PageHeader title="Monthly Review" subtitle="A calm look back at where your money went." />
      {!hydrated ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : !demo ? (
        <EmptyState icon={CalendarCheck} title="Your first review is on its way" text="Log a few weeks of spending and we'll show trends here." />
      ) : (
        <section className="card-soft p-6">
          <h2 className="font-semibold">Eating out is trending up</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatINR(first)} in May → {formatINR(last)} in October (+{Math.round(((last - first) / first) * 100)}%).
          </p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_EATING_OUT}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
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
