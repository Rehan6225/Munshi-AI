import { useEffect, useRef, useState } from "react";
import { Mic, ArrowUp, Loader2 } from "lucide-react";
import { HeardCard } from "./heard-card";
import { MunshiBubble, MuteButton } from "./munshi";
import { parseVoiceWithAi } from "@/lib/ai.functions";
import { useStore } from "@/lib/store";
import {
  munshiReply,
  weeklyAside,
  type Line,
  type MunshiEvent,
  type MunshiReply,
} from "@/lib/munshi";
import { speak } from "@/lib/speech";
import { merchantKey, yearlyCost } from "@/lib/recurring";
import { parseLocally, sanitizeAiParse, type VoiceAction, type VoiceParse } from "@/lib/voice";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/** Minimal shape of the browser's speech recognition API, which TypeScript doesn't ship. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onend: () => void;
  start: () => void;
}
type RecognitionCtor = new () => Recognition;

/** Munshi's latest reply, plus a follow-up button when it helps. */
interface Said {
  reply: MunshiReply;
  offerCancel?: { key: string; name: string; yearly: number } | undefined;
}

export function VoiceBar() {
  const [text, setText] = useState("");
  const isMobile = useIsMobile();
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<VoiceParse | null>(null);
  const [said, setSaid] = useState<Said | null>(null);

  // Replies fade after a while; ones with a follow-up button stay longer.
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(null), said.offerCancel ? 20000 : 9000);
    return () => clearTimeout(t);
  }, [said]);
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
      const parsed = await understand(value);
      setSaid(null);
      if (parsed.actions.length) setDraft(parsed);
      else {
        setDraft(null);
        respond({ reply: munshiReply({ kind: "not-understood" }) });
      }
      setText("");
      if (ref.current) ref.current.style.height = "auto";
    } finally {
      setBusy(false);
    }
  };

  const save = (actions: VoiceAction[]) => {
    const replies: MunshiReply[] = [];
    const spends: Extract<MunshiEvent, { kind: "logged" }>["spends"] = [];
    let aside: Line | undefined;
    let offerCancel: Said["offerCancel"];

    for (const a of actions) {
      if (a.type === "expense") {
        if (!a.amount) continue;
        const tx = add({
          merchant: a.merchant,
          category: a.category,
          amount: a.amount,
          date: new Date(Date.now() - a.daysAgo * 86400000).toISOString(),
        });
        spends.push({ ...tx, learned: !!tx.ruleId });
        aside ??= weeklyAside(tx.merchant, tx.category, [tx, ...transactions]);
      } else if (a.type === "rule") {
        const refiled = learnRule(a.merchant, a.category);
        replies.push(
          munshiReply({ kind: "rule", merchant: a.merchant, category: a.category, refiled }),
        );
      } else {
        const sub =
          subscriptions.find((s) => merchantKey(s.name) === merchantKey(a.merchant)) ??
          subscriptions.find((s) => merchantKey(s.name).includes(merchantKey(a.merchant)));
        if (!sub) {
          replies.push(munshiReply({ kind: "no-subscription", name: a.merchant }));
          continue;
        }
        const yearly = yearlyCost(sub);
        if (a.action === "unused") {
          markUnused(sub.key);
          offerCancel = { key: sub.key, name: sub.name, yearly };
        } else if (a.action === "cancel") cancelSub(sub.key);
        else markUsed(sub.key);
        replies.push(munshiReply({ kind: a.action, name: sub.name, yearly }));
      }
    }
    if (spends.length) replies.unshift(munshiReply({ kind: "logged", spends }));

    respond({
      reply: {
        text: replies.map((r) => r.text).join(" "),
        hindi: replies.map((r) => r.hindi).join(" "),
        aside,
      },
      offerCancel,
    });
    setDraft(null);
    ref.current?.focus();
  };

  /** Show Munshi's reply and say it out loud. */
  const respond = (next: Said) => {
    setSaid(next);
    const { reply } = next;
    speak(
      reply.aside
        ? {
            text: `${reply.text} ${reply.aside.text}`,
            hindi: `${reply.hindi} ${reply.aside.hindi}`,
          }
        : reply,
    );
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
        {said && !draft && (
          <MunshiBubble reply={said.reply} onClose={() => setSaid(null)}>
            {said.offerCancel && (
              <button
                onClick={() => {
                  const { key, name, yearly } = said.offerCancel!;
                  cancelSub(key);
                  respond({ reply: munshiReply({ kind: "cancel", name, yearly }) });
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Haan, cancel karo
              </button>
            )}
          </MunshiBubble>
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
            placeholder={
              // The full example doesn't fit on a phone, so it gets the short version.
              isMobile
                ? "Speak via Wispr Flow"
                : "Just say it through Wispr Flow — “Spent 480 on Swiggy last night”"
            }
            aria-label="Voice command"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <MuteButton />
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
