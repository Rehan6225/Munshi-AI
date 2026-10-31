import { createFileRoute } from "@tanstack/react-router";
import { Repeat, Ghost, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CardSkeletons, EmptyState } from "@/components/states";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Munshi AI" },
      { name: "description", content: "All your recurring payments and upcoming renewals in one place." },
      { property: "og:title", content: "Subscriptions — Munshi AI" },
      { property: "og:description", content: "All your recurring payments and upcoming renewals in one place." },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, subscriptions, cancelSub } = useStore();
  const monthly = subscriptions.reduce((s, x) => s + (x.cycle === "Yearly" ? x.amount / 12 : x.amount), 0);
  return (
    <>
      <PageHeader title="Subscriptions" subtitle={subscriptions.length ? `About ${formatINR(monthly)} a month on autopay.` : undefined} />
      {!hydrated ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><CardSkeletons count={3} /></div>
      ) : subscriptions.length === 0 ? (
        <EmptyState icon={Repeat} title="No subscriptions tracked" text="We'll spot recurring payments like Netflix or Spotify as you log them." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((s) => (
            <div key={s.name} className={cn("card-soft flex flex-col p-6", s.flag && "border-primary/30")}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate font-medium">{s.name}</p>
                {s.flag === "forgotten" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    <Ghost className="size-3" /> Forgotten
                  </span>
                )}
                {s.flag === "price-hike" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                    <TrendingUp className="size-3" /> Price hike
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatINR(s.amount)}
                {s.previousAmount && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{formatINR(s.previousAmount)}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.cycle} · renews {s.next} · last used {s.lastUsed.toLowerCase()}
              </p>
              {s.flag === "forgotten" && (
                <button
                  onClick={() => {
                    cancelSub(s.name);
                    toast.success(`${s.name} marked to cancel`, { description: `That's ${formatINR(s.amount * 12)} a year back in your pocket.` });
                  }}
                  className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Cancel & save {formatINR(s.amount * 12)}/yr
                </button>
              )}
              {s.flag === "price-hike" && s.previousAmount && (
                <p className="mt-5 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  Up {formatINR(s.amount - s.previousAmount)}/month. The Basic plan at ₹199 covers one screen.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
