import { createFileRoute } from "@tanstack/react-router";
import { Receipt, Upload } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TxList } from "@/components/tx-list";
import { EmptyState, ListSkeleton } from "@/components/states";
import { ImportDialog } from "@/components/import-dialog";
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
  const { hydrated, transactions, loadDemo } = useStore();
  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Add one by typing or dictating below."
        action={
          <ImportDialog>
            <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-primary/50">
              <Upload className="size-4 text-primary" />
              Import
            </button>
          </ImportDialog>
        }
      />
      {!hydrated ? (
        <div className="card-soft p-6"><ListSkeleton rows={8} /></div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          text="Try saying “Paid 1,200 for groceries at DMart this morning” in the bar below, or import a bank statement."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ImportDialog>
                <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                  Import a statement
                </button>
              </ImportDialog>
              <button onClick={loadDemo} className="rounded-xl border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-primary/50">
                Try with demo data
              </button>
            </div>
          }
        />
      ) : (
        <div className="card-soft px-4 pb-2 pt-2 sm:px-6">
          <TxList items={transactions} />
        </div>
      )}
    </>
  );
}
