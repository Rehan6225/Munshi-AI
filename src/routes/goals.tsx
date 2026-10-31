import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Target } from "lucide-react";
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
  const { hydrated, goals, profile, spend, invested } = useStore();
  const free = Math.max(0, profile.income - spend - invested);
  const editLink = (
    <Link
      to="/profile"
      className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/70"
    >
      <Pencil className="size-4" /> Edit goals
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Goals"
        subtitle={
          profile.income > 0
            ? `You have about ${formatINR(free)}/month left after spending and investments, split across your goals.`
            : "Add your income in Money profile to see how your goals are tracking."
        }
      />
      {!hydrated ? (
        <div className="grid gap-5 md:grid-cols-2">
          <CardSkeletons count={3} />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          text="Start with an emergency fund. 6 months of expenses is a solid first target."
          action={editLink}
        />
      ) : (
        <>
          <div className="mb-5 flex justify-end">{editLink}</div>
          <div className="grid gap-5 md:grid-cols-2">
            {goals.map((g) => (
              <div key={g.id} className="card-soft p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-lg font-semibold">{g.name}</p>
                  <StatusBadge status={g.status} />
                </div>
                <Progress value={g.pct} className="mt-4 h-1.5" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {formatINR(g.saved)} of {formatINR(g.target)} · by{" "}
                  {new Date(g.due).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}{" "}
                  · {g.pct}%
                </p>
                {g.emergency && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Target = {profile.emergencyMonths} months of spending
                  </p>
                )}
                <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed">
                  {g.note}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
