import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/monthly-review")({
  head: () => ({
    meta: [
      { title: "Monthly Review — Pesa Pilot" },
      { name: "description", content: "A calm look back at where your money went this month." },
      { property: "og:title", content: "Monthly Review — Pesa Pilot" },
      { property: "og:description", content: "A calm look back at where your money went this month." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Monthly Review" subtitle="A calm look back at where your money went this month." />
      <div className="card-soft p-10 text-center text-muted-foreground">Coming soon.</div>
    </>
  );
}
