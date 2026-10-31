import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/what-if")({
  head: () => ({
    meta: [
      { title: "What If — Pesa Pilot" },
      { name: "description", content: "Play out scenarios like a raise, a new EMI or cutting food delivery." },
      { property: "og:title", content: "What If — Pesa Pilot" },
      { property: "og:description", content: "Play out scenarios like a raise, a new EMI or cutting food delivery." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="What If" subtitle="Play out scenarios like a raise, a new EMI or cutting food delivery." />
      <div className="card-soft p-10 text-center text-muted-foreground">Coming soon.</div>
    </>
  );
}
