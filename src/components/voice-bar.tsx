import { useRef, useState } from "react";
import { Mic, ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HeardCard } from "./heard-card";
import { parseVoiceWithAi } from "@/lib/ai.functions";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { merchantKey, yearlyCost } from "@/lib/recurring";
import {
  parseLocally,
  sanitizeAiParse,
  summarize,
  type VoiceAction,
  type VoiceParse,
} from "@/lib/voice";
import { cn } from "@/lib/utils";

/** Minimal shape of the browser's speech recognition API, which TypeScript doesn't ship. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onend: () => void;
  start: () => void;
}
type RecognitionCtor = new () => Recognition;

export function VoiceBar() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<VoiceParse | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { add, transactions, subscriptions, cancelSub, markUsed, markUnused, learnRule } =
    useStore();

  /** Gemini first; the on-device parser if there's no key, no network, or a bad answer. */
  const understand = async (value: string): Promise<VoiceParse> => {
    const merchants = [...new Set(transactions.map((t) => t.merchant))];
    try {
      const res = await parseVoiceWithAi({
        data: {
          text: value,
          merchants,
          subscriptions: subscriptions.map((s) => s.name),
          today: new Date().toDateString(),
        },
      });
      if (res.ok) {
        const parsed = sanitizeAiParse(JSON.parse(res.json), value);
        if (parsed) return parsed;
      } else if (res.reason === "error") {
        console.warn("AI parsing failed, using the on-device parser:", res.message);
      }
    } catch (e) {
      console.warn("AI parsing unavailable, using the on-device parser:", e);
    }
    return parseLocally(value, { merchants, subscriptions });
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      setDraft(await understand(value));
      setText("");
      if (ref.current) ref.current.style.height = "auto";
    } finally {
      setBusy(false);
    }
  };

  const save = (actions: VoiceAction[]) => {
    for (const a of actions) {
      if (a.type === "expense") {
        if (!a.amount) continue;
        const tx = add({
          merchant: a.merchant,
          category: a.category,
          amount: a.amount,
          date: new Date(Date.now() - a.daysAgo * 86400000).toISOString(),
        });
        if (actions.length === 1)
          toast.success(`Logged ${formatINR(tx.amount)} · ${tx.merchant}`, {
            description: tx.ruleId ? `${tx.category} (learned from you 🧠)` : tx.category,
          });
      } else if (a.type === "rule") {
        const n = learnRule(a.merchant, a.category);
        toast.success(`Got it. ${a.merchant} → ${a.category}, always.`, {
          description: n
            ? `Refiled ${n} past transaction${n > 1 ? "s" : ""}.`
            : "Munshi will use this for new ones.",
        });
      } else {
        const sub =
          subscriptions.find((s) => merchantKey(s.name) === merchantKey(a.merchant)) ??
          subscriptions.find((s) => merchantKey(s.name).includes(merchantKey(a.merchant)));
        if (!sub) {
          toast(`I couldn't find a ${a.merchant} subscription`);
          continue;
        }
        const saving = `${formatINR(yearlyCost(sub))} a year`;
        if (a.action === "unused") {
          markUnused(sub.key);
          toast(`Got it, you don't use ${sub.name}`, {
            description: `Cancelling it saves ${saving}.`,
            action: { label: "Cancel it", onClick: () => cancelSub(sub.key) },
          });
        } else if (a.action === "cancel") {
          cancelSub(sub.key);
          toast.success(`${sub.name} marked to cancel`, {
            description: `That's ${saving} back in your pocket.`,
          });
        } else {
          markUsed(sub.key);
          toast.success(`Noted, you still use ${sub.name}`);
        }
      }
    }
    const summary = summarize(actions);
    if (summary) toast.success(summary);
    setDraft(null);
    ref.current?.focus();
  };

  const mic = () => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      ref.current?.focus();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => setText((t) => (t ? t + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className="sticky bottom-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-4xl px-4 pb-4 pt-6 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-auto">
        {draft && (
          <HeardCard
            parse={draft}
            onChange={(actions) => setDraft({ ...draft, actions })}
            onConfirm={() => save(draft.actions)}
            onCancel={() => setDraft(null)}
          />
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-glow">
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              // With an empty bar, Enter saves the card and Esc discards it.
              if (draft && !text.trim()) {
                if (e.key === "Enter" && draft.actions.length) {
                  e.preventDefault();
                  save(draft.actions);
                  return;
                }
                if (e.key === "Escape") {
                  setDraft(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Just say it — “Spent 480 on Swiggy last night”"
            aria-label="Voice command"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={mic}
            aria-label="Dictate"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground",
              listening && "bg-accent text-accent-foreground animate-pulse",
            )}
          >
            <Mic className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            aria-label="Send"
            disabled={!text.trim() || busy}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
