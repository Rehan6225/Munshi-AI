import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TxList } from "@/components/tx-list";
import { EmptyState, ListSkeleton } from "@/components/states";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Munshi AI" },
      { name: "description", content: "Every rupee you've spent, logged by voice or by hand." },
      { property: "og:title", content: "Transactions — Munshi AI" },
      { property: "og:description", content: "Every rupee you've spent, logged by voice or by hand." },
    ],
  }),
  component: Page,
});

function Page() {
  const { hydrated, transactions } = useStore();
  return (
    <>
      <PageHeader title="Transactions" subtitle="Add one by typing or dictating below." />
      {!hydrated ? (
        <div className="card-soft p-6"><ListSkeleton rows={8} /></div>
      ) : transactions.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions yet" text="Try saying “Paid 1,200 for groceries at DMart this morning” in the bar below." />
      ) : (
        <div className="card-soft px-4 pb-2 pt-2 sm:px-6">
          <TxList items={transactions} />
        </div>
      )}
    </>
  );
}
