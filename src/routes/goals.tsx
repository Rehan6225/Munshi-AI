import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, Sparkles, Target } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Progress } from "@/components/ui/progress";
import { CardSkeletons, EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { GoalDialog } from "@/components/goal-dialog";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { formatMonth } from "@/lib/plan";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Munshi AI" },
      {
        name: "description",
        content: "Track savings goals from a Goa trip to your emergency fund.",
      },
      { property: "og:title", content: "Goals — Munshi AI" },
      {
        property: "og:description",
        content: "Track savings goals from a Goa trip to your emergency fund.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, goals } = useStore();
  const addButton = (
    <GoalDialog>
      <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-primary/50">
        <Plus className="size-4 text-primary" />
        New goal
      </button>
    </GoalDialog>
  );
  return (
    <>
      <PageHeader
        title="Goals"
        subtitle="Small, steady steps."
        action={goals.length > 0 && addButton}
      />
      {!hydrated ? (
        <div className="grid gap-5 md:grid-cols-2">
          <CardSkeletons count={3} />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          text="Start with an emergency fund — 6 months of expenses is a solid first target."
          action={
            <GoalDialog>
              <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                Add your first goal
              </button>
            </GoalDialog>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
              return (
                <div key={g.id} className="card-soft p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-lg font-semibold">{g.name}</p>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={g.status} />
                      <GoalDialog goal={g}>
                        <button
                          aria-label={`Edit ${g.name}`}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </GoalDialog>
                    </div>
                  </div>
                  <Progress value={pct} className="mt-4 h-1.5" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formatINR(g.saved)} of {formatINR(g.target)} · by {formatMonth(g.due)} · {pct}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Putting aside {formatINR(g.monthly)} a month
                  </p>
                  <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed">
                    {g.note}
                  </p>
                </div>
              );
            })}
          </div>
          <Link
            to="/plan-ahead"
            className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-accent/50 p-4 text-sm transition hover:border-primary/60"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-primary" />
              See how cutting back or a raise would move these dates
            </span>
            <span className="shrink-0 font-medium text-primary">Try Plan Ahead →</span>
          </Link>
        </>
      )}
    </>
  );
}
