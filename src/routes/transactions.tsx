import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { TxList } from "@/components/tx-list";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Pesa Pilot" },
      { name: "description", content: "Every rupee you've spent, logged by voice or by hand." },
      { property: "og:title", content: "Transactions — Pesa Pilot" },
      { property: "og:description", content: "Every rupee you've spent, logged by voice or by hand." },
    ],
  }),
  component: Page,
});

function Page() {
  const { transactions } = useStore();
  return (
    <>
      <PageHeader title="Transactions" subtitle="Add one by typing or dictating below." />
      <div className="card-soft px-6 pb-2 pt-2">
        <TxList items={transactions} />
      </div>
    </>
  );
}
