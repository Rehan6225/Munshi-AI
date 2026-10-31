import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell";
import { CardSkeletons } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Money profile — Munshi AI" },
      { name: "description", content: "Your income, fixed costs, emergency fund and goals." },
      { property: "og:title", content: "Money profile — Munshi AI" },
      {
        property: "og:description",
        content: "Your income, fixed costs, emergency fund and goals.",
      },
    ],
  }),
  component: Page,
});

/** Money inputs: empty means 0, never NaN. */
const toAmount = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);
/** <input type="month"> works in "YYYY-MM". */
const toMonth = (iso: string) => iso.slice(0, 7);
const fromMonth = (v: string) => (v ? new Date(`${v}-01T00:00:00`).toISOString() : undefined);

function Page() {
  const {
    hydrated,
    profile,
    spend,
    fixed,
    goals,
    updateProfile,
    addFixedCost,
    updateFixedCost,
    removeFixedCost,
    saveGoal,
    addGoal,
    removeGoal,
  } = useStore();

  if (!hydrated) {
    return (
      <>
        <PageHeader title="Money profile" />
        <div className="grid gap-5 md:grid-cols-2">
          <CardSkeletons count={4} />
        </div>
      </>
    );
  }

  const free = profile.income - spend;

  return (
    <>
      <PageHeader
        title="Money profile"
        subtitle="Munshi plans everything from these numbers. Changes save automatically."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Monthly income" hint="Take-home pay, after tax.">
          <AmountInput value={profile.income} onChange={(income) => updateProfile({ income })} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Figure label="Spent in last 30 days" value={formatINR(spend)} />
            <Figure
              label="Left over"
              value={profile.income ? formatINR(free) : "—"}
              tone={free < 0 ? "bad" : "good"}
            />
          </div>
        </Card>

        <Card title="Fixed costs" hint="Bills you pay every month, no matter what.">
          <ul className="space-y-2">
            {fixed.items
              .filter((c) => c.detected)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{c.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                      <Sparkles className="size-3" /> detected
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatINR(c.amount)}
                  </span>
                </li>
              ))}
            {profile.extraFixedCosts.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Input
                  value={c.name}
                  placeholder="e.g. Car EMI"
                  aria-label="Fixed cost name"
                  onChange={(e) => updateFixedCost(c.id, { name: e.target.value })}
                />
                <AmountInput
                  value={c.amount}
                  onChange={(amount) => updateFixedCost(c.id, { amount })}
                  className="w-36 shrink-0"
                />
                <IconButton label="Remove" onClick={() => removeFixedCost(c.id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <AddButton onClick={addFixedCost}>Add a fixed cost</AddButton>
            <span className="text-sm">
              Total <span className="font-semibold tabular-nums">{formatINR(fixed.total)}</span>
              /month
            </span>
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Goals</h2>
          <AddButton onClick={addGoal}>Add goal</AddButton>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {goals.map((g) => (
            <div key={g.id} className="card-soft space-y-4 p-6">
              <div className="flex items-center gap-2">
                {g.emergency ? (
                  <p className="flex-1 font-semibold">Emergency fund</p>
                ) : (
                  <Input
                    value={g.name}
                    aria-label="Goal name"
                    onChange={(e) => saveGoal({ ...g, name: e.target.value })}
                    className="flex-1 font-semibold"
                  />
                )}
                <StatusBadge status={g.status} />
                {!g.emergency && (
                  <IconButton label={`Delete ${g.name}`} onClick={() => removeGoal(g.id)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.emergency ? (
                  <Field label="Months of spending">
                    <select
                      value={profile.emergencyMonths}
                      onChange={(e) => updateProfile({ emergencyMonths: Number(e.target.value) })}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      {[3, 6, 9, 12].map((m) => (
                        <option key={m} value={m} className="bg-popover">
                          {m} months
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Target">
                    <AmountInput
                      value={g.target}
                      onChange={(target) => saveGoal({ ...g, target })}
                    />
                  </Field>
                )}
                <Field label="Saved so far">
                  <AmountInput value={g.saved} onChange={(saved) => saveGoal({ ...g, saved })} />
                </Field>
                <Field label="Reach by">
                  <Input
                    type="month"
                    value={toMonth(g.due)}
                    onChange={(e) => {
                      const due = fromMonth(e.target.value);
                      if (due) saveGoal({ ...g, due });
                    }}
                  />
                </Field>
              </div>

              {g.emergency && (
                <p className="text-xs text-muted-foreground">
                  Target {formatINR(g.target)} = {profile.emergencyMonths} × your monthly spending.
                </p>
              )}
              <p className="rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed">{g.note}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="card-soft p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <Input
        inputMode="numeric"
        value={value ? value.toLocaleString("en-IN") : ""}
        placeholder="0"
        onChange={(e) => onChange(toAmount(e.target.value))}
        className="pl-7 tabular-nums"
      />
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-medium transition hover:bg-secondary/70"
    >
      <Plus className="size-4" /> {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-destructive"
    >
      {children}
    </button>
  );
}
