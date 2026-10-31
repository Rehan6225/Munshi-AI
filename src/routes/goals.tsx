import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Progress } from "@/components/ui/progress";
import { CardSkeletons, EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Munshi AI" },
      { name: "description", content: "Track savings goals from a Goa trip to your emergency fund." },
      { property: "og:title", content: "Goals — Munshi AI" },
      { property: "og:description", content: "Track savings goals from a Goa trip to your emergency fund." },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, goals } = useStore();
  return (
    <>
      <PageHeader title="Goals" subtitle="Small, steady steps." />
      {!hydrated ? (
        <div className="grid gap-5 md:grid-cols-2"><CardSkeletons count={3} /></div>
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" text="Start with an emergency fund — 6 months of expenses is a solid first target." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.round((g.saved / g.target) * 100);
            return (
              <div key={g.id} className="card-soft p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-lg font-semibold">{g.name}</p>
                  <StatusBadge status={g.status} />
                </div>
                <Progress value={pct} className="mt-4 h-1.5" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {formatINR(g.saved)} of {formatINR(g.target)} · by {g.due} · {pct}%
                </p>
                <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed">{g.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
