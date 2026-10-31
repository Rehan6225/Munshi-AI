import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/lib/plan";

export function StatusBadge({ status }: { status: GoalStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "At risk"
          ? "bg-destructive/15 text-destructive"
          : status === "Done"
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground",
      )}
    >
      {status}
    </span>
  );
}
