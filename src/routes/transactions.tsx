import { createFileRoute } from "@tanstack/react-router";
import { Brain, Receipt, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
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
      {
        property: "og:description",
        content: "Every rupee you've spent, logged by voice or by hand.",
      },
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
        subtitle="Add one by typing or dictating below. Change a category and Munshi learns it."
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
        <div className="card-soft p-6">
          <ListSkeleton rows={8} />
        </div>
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
              <button
                onClick={loadDemo}
                className="rounded-xl border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-primary/50"
              >
                Try with demo data
              </button>
            </div>
          }
        />
      ) : (
        <>
          <LearnedRules />
          <div className="card-soft px-4 pb-2 pt-2 sm:px-6">
            <TxList items={transactions} />
          </div>
        </>
      )}
    </>
  );
}

function LearnedRules() {
  const { rules, removeRule } = useStore();
  return (
    <section className="card-soft mb-5 p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Brain className="size-4 text-primary" /> Learned rules
        {rules.length > 0 && (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {rules.length}
          </span>
        )}
      </h2>
      {rules.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          None yet. Fix a category below and tap <span className="text-foreground">Remember</span>,
          or say “Swiggy is food, not groceries, remember that”.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-xl bg-secondary/60 py-1.5 pl-3 pr-1.5 text-sm"
            >
              <span>
                {r.merchant} → <span className="font-medium text-primary">{r.category}</span>
              </span>
              <span className="text-xs text-muted-foreground">used {r.applied}×</span>
              <button
                onClick={() => {
                  removeRule(r.id);
                  toast(`Forgot the ${r.merchant} rule`);
                }}
                aria-label={`Delete rule for ${r.merchant}`}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
