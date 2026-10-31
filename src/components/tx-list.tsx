import { AlertTriangle } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useStore, type Transaction } from "@/lib/store";

export function TxList({ items }: { items: Transaction[] }) {
  const { recategorize } = useStore();
  return (
    <ul className="mt-4 divide-y divide-border">
      {items.map((t) => (
        <li key={t.id} className="py-3.5 animate-in fade-in duration-300">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
                {t.merchant.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{t.merchant}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.category} · {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-medium tabular-nums">−{formatINR(t.amount)}</span>
          </div>
          {t.suggestedCategory && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/20 bg-accent px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2 text-accent-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t.merchant} looks like {t.suggestedCategory}, not {t.category}.
              </span>
              <button
                onClick={() => recategorize(t.id, t.suggestedCategory!)}
                className="self-start rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground sm:self-auto"
              >
                Move to {t.suggestedCategory}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
