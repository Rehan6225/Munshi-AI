import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PROFILE } from "@/lib/store";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Pesa Pilot" },
      { name: "description", content: "All your recurring payments and upcoming renewals in one place." },
      { property: "og:title", content: "Subscriptions — Pesa Pilot" },
      { property: "og:description", content: "All your recurring payments and upcoming renewals in one place." },
    ],
  }),
  component: Page,
});

function Page() {
  const monthly = PROFILE.subscriptions.reduce((s, x) => s + (x.cycle === "Yearly" ? x.amount / 12 : x.amount), 0);
  return (
    <>
      <PageHeader title="Subscriptions" subtitle={`About ${formatINR(monthly)} a month on autopay.`} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE.subscriptions.map((s) => (
          <div key={s.name} className="card-soft p-6">
            <p className="font-medium">{s.name}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{formatINR(s.amount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.cycle} · renews {s.next}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
