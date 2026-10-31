import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, FileText, Loader2, Lock, MessageSquareText, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatINR } from "@/lib/format";
import { merchantKey } from "@/lib/recurring";
import { useStore, type Category } from "@/lib/store";
import { parseCsv } from "@/lib/importers/csv";
import { toDrafts, type Draft, type ImportSource, type RawRow } from "@/lib/importers/rows";
import { parseSms } from "@/lib/importers/sms";
import { downloadFile, sampleCsv, samplePdf, sampleSms } from "@/lib/importers/samples";
import { cn } from "@/lib/utils";
import { CategorySelect } from "./category-select";

const SOURCES: { id: ImportSource; label: string; hint: string; icon: typeof FileText }[] = [
  { id: "pdf", label: "Statement PDF", hint: "HDFC, ICICI, SBI, Axis, Kotak", icon: FileText },
  { id: "csv", label: "CSV", hint: "Bank or app export", icon: FileSpreadsheet },
  { id: "sms", label: "Bank SMS", hint: "Paste debit alerts", icon: MessageSquareText },
];

const CONFIDENCE_DOT = {
  high: "bg-primary",
  medium: "bg-amber-400",
  low: "bg-destructive",
} as const;

/** The latest salary credit in an import, to suggest as the user's monthly income. */
function salaryIn(drafts: Draft[]): number | null {
  const salary = drafts
    .filter((d) => d.direction === "credit" && /salary|\bsal\b|payroll/i.test(d.description))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return salary?.amount ?? null;
}

/** A spend Munshi couldn't confidently categorise, and that isn't already in the list. */
const needsLook = (d: Draft) => d.direction === "debit" && !d.duplicate && d.confidence !== "high";

type View = "all" | "sure" | "unsure" | "dupes";

/** Import transactions from a statement PDF, a CSV export or pasted bank SMS. */
export function ImportDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<ImportSource>("pdf");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [sample, setSample] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDrafts(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-hidden rounded-3xl border-border bg-popover p-0",
          drafts ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        {drafts ? (
          <Review
            drafts={drafts}
            setDrafts={setDrafts}
            source={source}
            fileName={fileName}
            sample={sample}
            onBack={() => setDrafts(null)}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <Pick
            source={source}
            setSource={setSource}
            onParsed={(d, name, isSample) => {
              setFileName(name);
              setSample(isSample);
              setDrafts(d);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Pick({
  source,
  setSource,
  onParsed,
}: {
  source: ImportSource;
  setSource: (s: ImportSource) => void;
  /** `sample` is true for the built-in sample files, which assume a salary. */
  onParsed: (drafts: Draft[], name: string, sample: boolean) => void;
}) {
  const { transactions, ownRules } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sms, setSms] = useState("");
  const [locked, setLocked] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);

  const finish = (rows: RawRow[], name: string, sample = false) => {
    if (rows.length === 0) {
      setError("No transactions found. Check that this is a statement with dates and amounts.");
      return;
    }
    onParsed(toDrafts(rows, transactions, ownRules), name, sample);
  };

  const readFile = async (file: File, pdfPassword?: string) => {
    setBusy(true);
    setError("");
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const { parsePdf, PdfPasswordError } = await import("@/lib/importers/pdf");
        try {
          finish(await parsePdf(await file.arrayBuffer(), pdfPassword), file.name);
          setLocked(null);
        } catch (e) {
          if (e instanceof PdfPasswordError) {
            setLocked(file);
            if (pdfPassword)
              setError(
                "That password didn't work. Banks often use your date of birth or customer ID.",
              );
            return;
          }
          throw e;
        }
      } else {
        finish(parseCsv(await file.text()), file.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this file.");
    } finally {
      setBusy(false);
    }
  };

  const readSms = () => {
    const { rows, skipped } = parseSms(sms);
    if (rows.length === 0) {
      setError(
        skipped
          ? `None of the ${skipped} messages looked like a payment. Paste debit or spend alerts from your bank.`
          : "Paste one or more bank SMS alerts first.",
      );
      return;
    }
    if (skipped)
      toast(`${skipped} message${skipped > 1 ? "s" : ""} skipped`, {
        description: "OTPs and alerts that weren't payments.",
      });
    finish(rows, "Bank SMS", sms.trim() === sampleSms().trim());
  };

  const accept = source === "pdf" ? ".pdf,application/pdf" : ".csv,.tsv,.txt,text/csv";

  /** Imports the built-in sample straight away (SMS is pasted in so the user sees it first). */
  const loadSample = async () => {
    setError("");
    if (source === "sms") {
      setSms(sampleSms());
      return;
    }
    setBusy(true);
    try {
      if (source === "pdf") {
        const { parsePdf } = await import("@/lib/importers/pdf");
        finish(await parsePdf(await samplePdf()), "Sample statement.pdf", true);
      } else {
        finish(parseCsv(sampleCsv()), "Sample statement.csv", true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the sample.");
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = async () => {
    if (source === "pdf") {
      const pdf = new Blob([await samplePdf()], { type: "application/pdf" });
      downloadFile(pdf, "munshi-sample-statement.pdf");
    } else if (source === "csv") {
      downloadFile(new Blob([sampleCsv()], { type: "text/csv" }), "munshi-sample-statement.csv");
    } else {
      downloadFile(new Blob([sampleSms()], { type: "text/plain" }), "munshi-sample-sms.txt");
    }
  };

  return (
    <div className="grid gap-5 overflow-y-auto p-6">
      <DialogHeader className="text-left">
        <DialogTitle className="text-xl">Bring in your spending</DialogTitle>
        <DialogDescription>
          Start with last month. Munshi finds subscriptions and leaks from it.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSource(s.id);
              setError("");
              setLocked(null);
            }}
            className={cn(
              "grid gap-1 rounded-xl border p-3 text-left text-sm transition",
              source === s.id ? "border-primary bg-accent" : "bg-card hover:border-primary/40",
            )}
          >
            <s.icon
              className={cn("size-4", source === s.id ? "text-primary" : "text-muted-foreground")}
            />
            <span className="font-medium">{s.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{s.hint}</span>
          </button>
        ))}
      </div>

      {source === "sms" ? (
        <div className="grid gap-3">
          <textarea
            id="import-sms"
            value={sms}
            onChange={(e) => setSms(e.target.value)}
            rows={7}
            placeholder={
              "Rs.486.00 debited from A/c XX4421 on 24-10-26 to VPA swiggy@icici…\n\nINR 2,000.00 spent on ICICI Card XX9014 on 22-Oct-26 at IOCL…"
            }
            className="w-full resize-none rounded-xl border bg-card p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            In Messages, long-press your bank's alerts, copy them and paste here. Separate messages
            with a blank line.
          </p>
          <button
            onClick={readSms}
            disabled={!sms.trim()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Read messages
          </button>
        </div>
      ) : locked ? (
        <form
          className="grid gap-3 rounded-xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void readFile(locked, password);
          }}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Lock className="size-4 text-primary" /> {locked.name} is password-protected
          </p>
          <input
            id="import-pdf-password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Statement password"
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <button
            disabled={!password || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Unlock
          </button>
        </form>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
          className={cn(
            "grid cursor-pointer justify-items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary/40 bg-accent px-4 py-8 text-center transition",
            dragging && "border-primary bg-primary/20",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </span>
          <span className="text-sm font-semibold">
            {busy
              ? "Reading…"
              : source === "pdf"
                ? "Drop your bank statement"
                : "Drop your CSV export"}
          </span>
          <span className="text-xs text-muted-foreground">
            {source === "pdf"
              ? "PDF from net banking · password-protected is fine"
              : "Needs Date, Description and Amount (or Debit) columns"}
          </span>
          <input
            id="import-file"
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </label>
      )}

      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-dashed px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">
            No {source === "sms" ? "messages" : "file"} handy? Try ours, with rent, Netflix, Prime
            and more.
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void loadSample()}
              disabled={busy}
              className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
            >
              {source === "sms" ? "Paste sample" : "Use sample"}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => void downloadSample()}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Download
            </button>
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Read on your device. Nothing is saved until you review it.
      </p>
    </div>
  );
}

function Review({
  drafts,
  setDrafts,
  source,
  fileName,
  sample,
  onBack,
  onDone,
}: {
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  source: ImportSource;
  fileName: string;
  sample: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const { addMany, learnRule, ownRules, ownIncomeSet, applySampleProfile, askIncome } = useStore();
  const navigate = useNavigate();
  const [showCredits, setShowCredits] = useState(false);
  const [view, setView] = useState<View>("all");
  const [edited, setEdited] = useState<Set<string>>(new Set());

  const debits = drafts.filter((d) => d.direction === "debit");
  const credits = drafts.length - debits.length;
  const groups: Record<View, Draft[]> = {
    all: showCredits ? drafts : debits,
    sure: debits.filter((d) => !d.duplicate && !needsLook(d)),
    unsure: debits.filter(needsLook),
    dupes: debits.filter((d) => d.duplicate),
  };
  // When the last row in a filter is fixed (say, the final "need a look"), show everything again.
  const current: View = groups[view].length > 0 ? view : "all";
  const visible = groups[current];
  const selected = drafts.filter((d) => d.selected);
  const total = selected.reduce((sum, d) => sum + d.amount, 0);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const setCategory = (d: Draft, category: Category) => {
    // Apply the pick to every row from the same merchant that hasn't been set by hand.
    const mk = merchantKey(d.merchant);
    setDrafts(
      drafts.map((x) =>
        x.key === d.key || (merchantKey(x.merchant) === mk && !edited.has(x.key))
          ? { ...x, category, confidence: "high" }
          : x,
      ),
    );
    setEdited(new Set(edited).add(d.key));
    // Remember it right away in the user's own data, so it sticks even if this import is cancelled.
    const known = ownRules.find((r) => r.key === mk);
    if (known?.category !== category) {
      learnRule(d.merchant, category, "own");
      toast(`Munshi will file ${d.merchant} under ${category} from now on`);
    }
  };

  const save = () => {
    addMany(
      selected.map((d) => ({
        merchant: d.merchant,
        category: d.category,
        amount: d.amount,
        date: d.date,
        note: d.description,
        source,
        ...(d.recurring && { recurring: true }),
      })),
    );
    // Sample files come with the demo's salary, budgets and goals; real ones ask for the
    // salary, offering any salary credit found.
    if (sample) applySampleProfile();
    else if (!ownIncomeSet) askIncome(salaryIn(drafts));
    toast.success(`Added ${selected.length} transactions`);
    onDone();
    void navigate({ to: "/transactions" });
  };

  const stats: { view: View; label: string; tone?: string; active?: string }[] = [
    { view: "all", label: "spends found" },
    { view: "sure", label: "sure about category", active: "border-primary bg-accent" },
    {
      view: "unsure",
      label: "need a look",
      tone: "text-amber-400",
      active: "border-amber-400 bg-amber-400/10",
    },
    { view: "dupes", label: "already in Munshi", tone: "text-muted-foreground" },
  ];

  return (
    <div className="flex max-h-[92vh] min-h-0 flex-col">
      <DialogHeader className="p-6 pb-4 text-left">
        <DialogTitle className="text-xl">Review {fileName}</DialogTitle>
        <DialogDescription>
          Check the categories, untick anything you don't want, then add.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 px-6 sm:grid-cols-4">
        {stats.map((s) => {
          const count = s.view === "all" ? debits.length : groups[s.view].length;
          const on = current === s.view;
          return (
            <button
              key={s.view}
              onClick={() => setView(on ? "all" : s.view)}
              disabled={count === 0}
              aria-pressed={on}
              className={cn(
                "rounded-xl border bg-card px-3 py-2 text-left transition enabled:hover:border-primary/50 disabled:cursor-default disabled:opacity-60",
                on && (s.active ?? "border-primary/60"),
              )}
            >
              <b className={cn("block text-lg font-semibold tabular-nums", s.tone)}>{count}</b>
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </button>
          );
        })}
      </div>

      {current !== "all" && (
        <p className="mx-6 mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {visible.length} {stats.find((s) => s.view === current)!.label}
          </span>
          <button
            onClick={() => setView("all")}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Show all {debits.length}
          </button>
        </p>
      )}

      <ul className="mt-4 min-h-0 flex-1 divide-y divide-border overflow-y-auto border-y px-6">
        {visible.map((d) => (
          <li
            key={d.key}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_12rem_6rem]",
              !d.selected && "opacity-50",
              needsLook(d) && "-mx-6 bg-amber-400/5 px-6",
            )}
          >
            <Checkbox
              checked={d.selected}
              onCheckedChange={(v) => update(d.key, { selected: v === true })}
              aria-label={`Include ${d.merchant}`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {d.merchant}
                {d.duplicate && (
                  <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Already added
                  </span>
                )}
                {d.recurring && (
                  <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Subscription
                  </span>
                )}
                {d.remembered && (
                  <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Remembered
                  </span>
                )}
                {needsLook(d) && (
                  <span className="ml-2 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    Check category
                  </span>
                )}
                {d.direction === "credit" && (
                  <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    Money in
                  </span>
                )}
              </p>
              <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                {new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                {d.description}
              </p>
            </div>
            <span className="text-right text-sm font-medium tabular-nums sm:order-last">
              {d.direction === "credit" ? "+" : "−"}
              {formatINR(d.amount)}
            </span>
            <div className="col-start-2 sm:col-start-auto">
              <div className="flex h-8 items-center gap-2 rounded-lg border bg-card pl-2.5 pr-1 text-xs">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", CONFIDENCE_DOT[d.confidence])}
                />
                <CategorySelect
                  value={d.category}
                  onChange={(c) => setCategory(d, c)}
                  label={`Category for ${d.merchant}`}
                  className="min-w-0 flex-1 truncate"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 px-6 text-xs text-muted-foreground">
        {credits > 0 ? (
          <button
            onClick={() => setShowCredits(!showCredits)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {showCredits ? "Hide" : "Show"} {credits} money-in row{credits > 1 ? "s" : ""}
          </button>
        ) : (
          <span>{formatINR(total)} selected</span>
        )}
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </button>
          <button
            onClick={save}
            disabled={selected.length === 0}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Add {selected.length} transaction{selected.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
