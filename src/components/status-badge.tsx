import { cn } from "@/lib/utils";
import type { Goal } from "@/lib/store";

export function StatusBadge({ status }: { status: Goal["status"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "At risk" ? "bg-destructive/15 text-destructive" : "bg-accent text-accent-foreground",
      )}
    >
      {status}
    </span>
  );
}
