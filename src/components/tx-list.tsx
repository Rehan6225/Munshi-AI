import { formatINR } from "@/lib/format";
import type { Transaction } from "@/lib/store";

export function TxList({ items }: { items: Transaction[] }) {
  return (
    <ul className="mt-4 divide-y divide-border">
      {items.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
              {t.merchant.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{t.merchant}</p>
              <p className="text-xs text-muted-foreground">
                {t.category} · {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
          <span className="shrink-0 font-medium tabular-nums">−{formatINR(t.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
