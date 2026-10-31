import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Pesa Pilot" },
      { name: "description", content: "Ask your finance coach anything about your money." },
      { property: "og:title", content: "Coach — Pesa Pilot" },
      { property: "og:description", content: "Ask your finance coach anything about your money." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Coach" subtitle="Ask your finance coach anything about your money." />
      <div className="card-soft p-10 text-center text-muted-foreground">Coming soon.</div>
    </>
  );
}
