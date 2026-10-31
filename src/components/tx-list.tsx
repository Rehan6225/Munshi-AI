import { AlertTriangle, Brain } from "lucide-react";
import { toast } from "sonner";
import { CategorySelect } from "./category-select";
import { formatINR } from "@/lib/format";
import { merchantKey } from "@/lib/recurring";
import { useStore, type Category, type Transaction } from "@/lib/store";

export function TxList({ items }: { items: Transaction[] }) {
  const { transactions, suggestions, recategorize, learnRule } = useStore();

  /** Fix one transaction, then offer to remember it for the merchant. */
  const change = (t: Transaction, category: Category) => {
    recategorize(t.id, category);
    const others = transactions.filter(
      (o) => o.id !== t.id && merchantKey(o.merchant) === merchantKey(t.merchant),
    ).length;
    toast(`${t.merchant} moved to ${category}`, {
      description: others
        ? `Apply to all ${others + 1} ${t.merchant} transactions and future ones?`
        : `Always file future ${t.merchant} spends under ${category}?`,
      action: {
        label: "Remember",
        onClick: () => {
          const n = learnRule(t.merchant, category);
          toast.success(`Got it. ${t.merchant} → ${category}, always.`, {
            description: n
              ? `Refiled ${n} past transaction${n > 1 ? "s" : ""}.`
              : "Munshi will use this for new ones.",
          });
        },
      },
      cancel: { label: "Just this one", onClick: () => {} },
      duration: 8000,
    });
  };

  return (
    <ul className="mt-4 divide-y divide-border">
      {items.map((t) => {
        const suggested = suggestions.get(t.id);
        return (
          <li key={t.id} className="py-3.5 animate-in fade-in duration-300">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
                  {t.merchant.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.merchant}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <CategorySelect
                      value={t.category}
                      onChange={(c) => change(t, c)}
                      label={`Category for ${t.merchant}`}
                      className="-ml-1"
                    />
                    {t.ruleId && (
                      <span
                        title="Categorised by a rule Munshi learned from you"
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
                      >
                        <Brain className="size-3" /> learned
                      </span>
                    )}
                    <span>
                      ·{" "}
                      {new Date(t.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-medium tabular-nums">−{formatINR(t.amount)}</span>
            </div>
            {suggested && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/20 bg-accent px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2 text-accent-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  You usually file {t.merchant} under {suggested}, not {t.category}.
                </span>
                <button
                  onClick={() => change(t, suggested)}
                  className="self-start rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground sm:self-auto"
                >
                  Move to {suggested}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
