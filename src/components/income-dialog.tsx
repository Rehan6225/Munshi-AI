import { useEffect, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Asks for the user's monthly take-home pay. Mounted once in the app shell and opened
 * through the store, so an import or any "Add your income" button can bring it up.
 */
export function IncomePrompt() {
  const { incomePrompt, closeIncomePrompt, setIncome, income, incomeAssumed } = useStore();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!incomePrompt) return;
    const start = incomePrompt.suggested ?? (incomeAssumed ? null : income);
    setValue(start ? String(start) : "");
  }, [incomePrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = Number(value) || 0;
  const save = () => {
    if (amount <= 0) return;
    setIncome(amount);
    closeIncomePrompt();
    toast.success(`Monthly income set to ${formatINR(amount)}`);
  };

  return (
    <Dialog open={Boolean(incomePrompt)} onOpenChange={(open) => !open && closeIncomePrompt()}>
      <DialogContent className="rounded-3xl border-border bg-popover sm:max-w-md">
        <DialogHeader className="text-left">
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-accent">
            <Wallet className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-xl">What's your monthly salary?</DialogTitle>
          <DialogDescription>
            Your take-home pay after tax. Munshi uses it for your savings rate, Plan Ahead and
            reports. It stays on this device.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {incomePrompt?.suggested && (
            <p className="rounded-xl bg-accent px-3 py-2.5 text-xs leading-relaxed text-accent-foreground">
              Your statement has a salary credit of{" "}
              <b className="font-semibold">{formatINR(incomePrompt.suggested)}</b>. We've filled it
              in. Change it if your take-home pay is different.
            </p>
          )}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
              ₹
            </span>
            <input
              id="monthly-income"
              inputMode="numeric"
              autoFocus
              value={value ? Number(value).toLocaleString("en-IN") : ""}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
              placeholder="65,000"
              aria-label="Monthly take-home pay"
              className="w-full rounded-xl border bg-card py-3 pl-8 pr-3 text-lg font-semibold tabular-nums outline-none transition focus:border-primary/60"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeIncomePrompt}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Later
            </button>
            <button
              disabled={amount <= 0}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A brief pop-up when the salary in use is a stand-in (demo or sample data). It disappears
 * on its own and doesn't change any page layout. Shows once each time that salary comes into use.
 */
export function AssumedIncomeToast() {
  const { hydrated, income, incomeAssumed, mode, askIncome } = useStore();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !incomeAssumed || income === null) {
      shown.current = null;
      return;
    }
    const key = `${mode}:${income}`;
    if (shown.current === key) return;
    shown.current = key;
    toast(`Assuming a monthly salary of ${formatINR(income)}`, {
      id: "assumed-income",
      duration: 4000,
      ...(mode !== "demo" && { action: { label: "Use mine", onClick: () => askIncome() } }),
    });
  }, [hydrated, income, incomeAssumed, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Stands in wherever a number needs the user's income and we don't have it yet. */
export function AddIncomeButton({ className }: { className?: string }) {
  const { askIncome } = useStore();
  return (
    <button
      onClick={() => askIncome()}
      className={cn(
        "rounded-lg border border-dashed border-primary/40 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-accent",
        className,
      )}
    >
      Add your income
    </button>
  );
}
