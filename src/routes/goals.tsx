import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Progress } from "@/components/ui/progress";
import { PROFILE } from "@/lib/store";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Pesa Pilot" },
      { name: "description", content: "Track savings goals from a Goa trip to a house down payment." },
      { property: "og:title", content: "Goals — Pesa Pilot" },
      { property: "og:description", content: "Track savings goals from a Goa trip to a house down payment." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Goals" subtitle="Small, steady steps." />
      <div className="grid gap-5 md:grid-cols-2">
        {PROFILE.goals.map((g) => {
          const pct = Math.round((g.saved / g.target) * 100);
          return (
            <div key={g.id} className="card-soft p-6">
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-semibold">{g.name}</p>
                <span className="text-sm text-primary">{pct}%</span>
              </div>
              <Progress value={pct} className="mt-4 h-1.5" />
              <p className="mt-3 text-sm text-muted-foreground">
                {formatINR(g.saved)} of {formatINR(g.target)} · by {g.due}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
