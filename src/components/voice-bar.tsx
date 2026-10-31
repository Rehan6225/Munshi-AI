import { useRef, useState } from "react";
import { Mic, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { parseCommand } from "@/lib/parse-command";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { parseUsageCommand, yearlyCost } from "@/lib/recurring";
import { cn } from "@/lib/utils";

export function VoiceBar() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { add, subscriptions, cancelSub, markUsed, markUnused } = useStore();

  const submit = () => {
    const value = text.trim();
    if (!value) return;

    const usage = parseUsageCommand(value, subscriptions);
    // "Paid 1299 at Cult, went to the gym" is an expense, not a usage check-in.
    if (usage && !(usage.action === "used" && parseCommand(value).amount)) {
      const { action, sub } = usage;
      const saving = `${formatINR(yearlyCost(sub))} a year`;
      if (action === "unused") {
        markUnused(sub.key);
        toast(`Got it, you don't use ${sub.name}`, {
          description: `Cancelling it saves ${saving}.`,
          action: { label: "Cancel it", onClick: () => cancelSub(sub.key) },
        });
      } else if (action === "cancel") {
        cancelSub(sub.key);
        toast.success(`${sub.name} marked to cancel`, {
          description: `That's ${saving} back in your pocket.`,
        });
      } else {
        markUsed(sub.key);
        toast.success(`Noted, you still use ${sub.name}`);
      }
      setText("");
      return;
    }

    const p = parseCommand(value);
    if (!p.amount) {
      toast("Couldn't find an amount", {
        description: "Try something like “Spent 480 on Swiggy last night”.",
      });
      return;
    }
    add({
      merchant: p.merchant,
      category: p.category,
      amount: p.amount,
      date: new Date(Date.now() - p.daysAgo * 86400000).toISOString(),
      note: value,
    });
    toast.success(`Logged ${formatINR(p.amount)} · ${p.merchant}`, { description: p.category });
    setText("");
  };

  const mic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      ref.current?.focus();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e: any) => setText((t) => (t ? t + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className="sticky bottom-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-4xl px-4 pb-4 pt-6 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-auto">
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
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
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
            onClick={submit}
            aria-label="Send"
            disabled={!text.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
