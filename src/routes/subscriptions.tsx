import { createFileRoute } from "@tanstack/react-router";
import { Repeat, Ghost, TrendingUp, TrendingDown, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CardSkeletons, EmptyState } from "@/components/states";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { daysSince, yearlyCost, type Recurring, type RecurringAlert } from "@/lib/recurring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Munshi AI" },
      {
        name: "description",
        content: "All your recurring payments and upcoming renewals in one place.",
      },
      { property: "og:title", content: "Subscriptions — Munshi AI" },
      {
        property: "og:description",
        content: "All your recurring payments and upcoming renewals in one place.",
      },
    ],
  }),
  component: Page,
});

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const BADGES: Record<RecurringAlert, { label: string; icon: typeof Ghost; className: string }> = {
  unused: { label: "Unused", icon: Ghost, className: "bg-destructive/15 text-destructive" },
  "price-up": {
    label: "Price hike",
    icon: TrendingUp,
    className: "bg-accent text-accent-foreground",
  },
  "price-down": {
    label: "Price drop",
    icon: TrendingDown,
    className: "bg-accent text-accent-foreground",
  },
  new: { label: "New", icon: Sparkles, className: "bg-secondary text-foreground" },
};

function Page() {
  const { hydrated, subscriptions } = useStore();
  const subs = subscriptions.filter((s) => s.kind === "subscription");
  const bills = subscriptions.filter((s) => s.kind === "bill");
  const monthly = subscriptions.reduce((sum, s) => sum + yearlyCost(s) / 12, 0);
  const savable = subs
    .filter((s) => s.alerts.includes("unused"))
    .reduce((sum, s) => sum + yearlyCost(s), 0);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle={
          subscriptions.length
            ? `${subscriptions.length} recurring payments found in your transactions · about ${formatINR(monthly)} a month on autopay.`
            : undefined
        }
      />
      {!hydrated ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeletons count={3} />
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring payments yet"
          text="Munshi spots monthly and yearly charges like Netflix or rent once it sees them repeat."
        />
      ) : (
        <>
          {savable > 0 && (
            <div className="card-soft mb-5 flex items-center gap-3 border-primary/30 p-5 text-sm">
              <Ghost className="size-5 shrink-0 text-primary" />
              <p>
                Cancelling what you don't use saves{" "}
                <span className="font-semibold text-primary">{formatINR(savable)} a year</span>.
              </p>
            </div>
          )}
          <Section title="Subscriptions" items={subs} />
          {bills.length > 0 && <Section title="Bills & rent" items={bills} />}
        </>
      )}
    </>
  );
}

function Section({ title, items }: { title: string; items: Recurring[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <Card key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}

function Card({ s }: { s: Recurring }) {
  const { cancelSub, markUsed, markUnused } = useStore();
  const unused = s.alerts.includes("unused");
  const diff = s.previousAmount ? s.amount - s.previousAmount : 0;

  return (
    <div className={cn("card-soft flex flex-col p-6", s.alerts.length > 0 && "border-primary/30")}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{s.name}</p>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {s.alerts.map((a) => {
            const b = BADGES[a];
            return (
              <span
                key={a}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  b.className,
                )}
              >
                <b.icon className="size-3" /> {b.label}
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-2xl font-semibold tabular-nums">
        {formatINR(s.amount)}
        {s.previousAmount && (
          <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
            {formatINR(s.previousAmount)}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {s.cycle} · next {shortDate(s.next)} · {s.charges} charges seen
      </p>
      {s.kind === "subscription" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {s.lastUsed === null
            ? "You said you don't use this"
            : s.lastUsed
              ? `Last used ${usedAgo(s.lastUsed)}`
              : "Usage unknown"}
        </p>
      )}

      {s.previousAmount && s.changedOn && (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {diff > 0 ? "Up" : "Down"} {formatINR(Math.abs(diff))}/
          {s.cycle === "Yearly" ? "year" : "month"} since {shortDate(s.changedOn)}. That's{" "}
          {formatINR(Math.abs(s.cycle === "Yearly" ? diff : diff * 12))}{" "}
          {diff > 0 ? "more" : "less"} a year.
        </p>
      )}
      {s.alerts.includes("new") && (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
          New autopay spotted. It started {shortDate(s.firstCharged)}. Did you mean to sign up?
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {unused ? (
          <button
            onClick={() => {
              cancelSub(s.key);
              toast.success(`${s.name} marked to cancel`, {
                description: `That's ${formatINR(yearlyCost(s))} a year back in your pocket.`,
              });
            }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Cancel & save {formatINR(yearlyCost(s))}/yr
          </button>
        ) : (
          s.kind === "subscription" && (
            <>
              <button
                onClick={() => {
                  markUsed(s.key);
                  toast(`Noted, you still use ${s.name}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium transition hover:bg-secondary/70"
              >
                <Check className="size-3.5" /> Used it recently
              </button>
              <button
                onClick={() => markUnused(s.key)}
                className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                I don't use this
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}

function usedAgo(iso: string) {
  const days = daysSince(iso);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}
