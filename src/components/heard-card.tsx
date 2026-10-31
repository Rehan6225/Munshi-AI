import { Brain, Check, Repeat, Sparkles, Tag, X, Zap } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { findRule } from "@/lib/rules";
import { useStore, type Category } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { VoiceAction, VoiceParse } from "@/lib/voice";

const dayLabel = (n: number) => (n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

/**
 * "What Munshi heard": the raw sentence with fillers and take-backs struck out,
 * then the clean entries, which the user can tweak before anything is saved.
 */
export function HeardCard({
  parse,
  onChange,
  onConfirm,
  onCancel,
}: {
  parse: VoiceParse;
  onChange: (actions: VoiceAction[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { rules } = useStore();
  const update = (i: number, patch: Partial<VoiceAction>) =>
    onChange(parse.actions.map((a, j) => (j === i ? ({ ...a, ...patch } as VoiceAction) : a)));
  const remove = (i: number) => onChange(parse.actions.filter((_, j) => j !== i));
  const cleaned = parse.heard.some((s) => s.kind !== "keep");

  return (
    <div className="mb-2 rounded-2xl border bg-card p-4 shadow-glow animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What Munshi heard
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
          {parse.engine === "ai" ? (
            <>
              <Sparkles className="size-3" /> Gemini
            </>
          ) : (
            <>
              <Zap className="size-3" /> On-device
            </>
          )}
        </span>
      </div>

      <p className="mt-2 text-[15px] leading-relaxed">
        <span className="text-muted-foreground">“</span>
        {parse.heard.map((s, i) => (
          <span
            key={i}
            className={cn(
              s.kind === "filler" &&
                "text-muted-foreground/60 line-through decoration-muted-foreground/60",
              s.kind === "corrected" &&
                "text-destructive/80 line-through decoration-destructive/80",
            )}
          >
            {s.text}
          </span>
        ))}
        <span className="text-muted-foreground">”</span>
      </p>
      {cleaned && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          {parse.heard.some((s) => s.kind === "filler") && (
            <span>
              <span className="line-through">grey</span> = filler words
            </span>
          )}
          {parse.heard.some((s) => s.kind === "corrected") && (
            <span>
              <span className="text-destructive/80 line-through">red</span> = you corrected yourself
            </span>
          )}
        </p>
      )}

      {parse.actions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          I couldn't find a spend in that. Try “Spent 480 on Swiggy last night”.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {parse.actions.map((a, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-xl bg-secondary/60 p-2 pl-3 text-sm"
            >
              {a.type === "expense" ? (
                <ExpenseRow
                  action={a}
                  learned={findRule(a.merchant, rules)?.category}
                  onAmount={(amount) => update(i, { amount })}
                  onCategory={(category) => update(i, { category })}
                />
              ) : a.type === "rule" ? (
                <span className="flex flex-1 items-center gap-2">
                  <Tag className="size-4 shrink-0 text-primary" />
                  Always file <b>{a.merchant}</b> under <b className="text-primary">{a.category}</b>
                </span>
              ) : (
                <span className="flex flex-1 items-center gap-2">
                  <Repeat className="size-4 shrink-0 text-primary" />
                  {a.action === "cancel"
                    ? `Cancel ${a.merchant}`
                    : a.action === "unused"
                      ? `Mark ${a.merchant} as unused`
                      : `Note that you still use ${a.merchant}`}
                </span>
              )}
              <button
                onClick={() => remove(i)}
                aria-label="Remove"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-[11px] text-muted-foreground sm:block">
          Enter to save · Esc to discard
        </span>
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          Discard
        </button>
        <button
          onClick={onConfirm}
          disabled={parse.actions.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
        >
          <Check className="size-4" /> Save
          {parse.actions.length > 1 ? ` all ${parse.actions.length}` : ""}
        </button>
      </div>
    </div>
  );
}

function ExpenseRow({
  action,
  learned,
  onAmount,
  onCategory,
}: {
  action: Extract<VoiceAction, { type: "expense" }>;
  learned: Category | undefined;
  onAmount: (n: number) => void;
  onCategory: (c: Category) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex items-center font-semibold tabular-nums">
        ₹
        <input
          inputMode="numeric"
          value={action.amount ? action.amount.toLocaleString("en-IN") : ""}
          onChange={(e) => onAmount(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
          aria-label="Amount"
          className="w-20 bg-transparent outline-none"
          size={1}
        />
      </label>
      <span className="min-w-0 truncate font-medium">{action.merchant}</span>
      {learned ? (
        <span
          title="A rule you taught Munshi decides this category"
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground"
        >
          <Brain className="size-3" /> {learned}
        </span>
      ) : (
        <select
          value={action.category}
          onChange={(e) => onCategory(e.target.value as Category)}
          aria-label="Category"
          className="rounded-md bg-transparent px-1 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-popover">
              {c}
            </option>
          ))}
        </select>
      )}
      <span className="text-xs text-muted-foreground">{dayLabel(action.daysAgo)}</span>
    </div>
  );
}
