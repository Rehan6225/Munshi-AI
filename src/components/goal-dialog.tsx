import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { formatMonth, monthFrom, planGoal } from "@/lib/plan";
import { useStore, type Goal } from "@/lib/store";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary/60";

/** Add a goal, or edit one when `goal` is passed. Shows the plan live as you type. */
export function GoalDialog({ goal, children }: { goal?: Goal; children: ReactNode }) {
  const { addGoal, updateGoal, removeGoal } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [monthly, setMonthly] = useState("");
  const [due, setDue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reset = () => {
    setName(goal?.name ?? "");
    setTarget(goal ? String(goal.target) : "");
    setSaved(goal ? String(goal.saved) : "");
    setMonthly(goal ? String(goal.monthly) : "");
    setDue(goal?.due ?? monthFrom(new Date(), 12));
    setConfirmDelete(false);
  };

  const num = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, "")) || 0);
  const input = {
    name: name.trim(),
    target: num(target),
    saved: num(saved),
    monthly: num(monthly),
    due,
  };
  const valid = input.name && input.target > 0 && /^\d{4}-\d{2}$/.test(due);
  const preview = valid ? planGoal({ ...input, id: "preview" }) : null;

  const save = () => {
    if (!valid) return;
    if (goal) updateGoal(goal.id, input);
    else addGoal(input);
    toast.success(goal ? `${input.name} updated` : `${input.name} added`);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border bg-popover sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{goal ? `Edit ${goal.name}` : "New goal"}</DialogTitle>
          <DialogDescription>
            Munshi works out whether you're on track from these numbers.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="What are you saving for?" htmlFor="goal-name">
            <input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emergency fund, Goa trip, new laptop…"
              className={field}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target" htmlFor="goal-target">
              <Rupee id="goal-target" value={target} onChange={setTarget} placeholder="3,00,000" />
            </Field>
            <Field label="Saved so far" htmlFor="goal-saved">
              <Rupee id="goal-saved" value={saved} onChange={setSaved} placeholder="0" />
            </Field>
            <Field label="Put aside each month" htmlFor="goal-monthly">
              <Rupee id="goal-monthly" value={monthly} onChange={setMonthly} placeholder="10,000" />
            </Field>
            <Field label="Reach it by" htmlFor="goal-due">
              <input
                id="goal-due"
                type="month"
                value={due}
                min={monthFrom(new Date(), 0)}
                onChange={(e) => setDue(e.target.value)}
                className={field}
              />
            </Field>
          </div>

          {preview && (
            <p
              className={cn(
                "rounded-xl p-3 text-xs leading-relaxed",
                preview.status === "At risk"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground",
              )}
            >
              <b className="font-semibold">{preview.status}.</b> {preview.note}
              {preview.status === "At risk" && preview.needed > input.monthly && (
                <>
                  {" "}
                  To finish by {formatMonth(due)}, put aside {formatINR(preview.needed)} a month.
                </>
              )}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {goal ? (
              confirmDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    removeGoal(goal.id);
                    toast(`${goal.name} deleted`);
                    setOpen(false);
                  }}
                  className="rounded-xl bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground"
                >
                  Yes, delete it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
                >
                  Delete goal
                </button>
              )
            ) : (
              <span />
            )}
            <button
              disabled={!valid}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {goal ? "Save changes" : "Add goal"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** A ₹ amount field that shows Indian digit grouping as you type. */
function Rupee({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const digits = value.replace(/[^\d]/g, "");
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <input
        id={id}
        inputMode="numeric"
        value={digits ? Number(digits).toLocaleString("en-IN") : ""}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
        placeholder={placeholder}
        className={cn(field, "pl-7 tabular-nums")}
      />
    </div>
  );
}
