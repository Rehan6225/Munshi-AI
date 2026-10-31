import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2, MessageCircle, ShieldCheck, Sparkles, Volume2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MunshiAvatar } from "@/components/munshi";
import { EmptyState } from "@/components/states";
import { askCoach } from "@/lib/coach.functions";
import { answerLocally, buildSnapshot } from "@/lib/coach";
import { asksForSecurities, guardrailAnswer } from "@/lib/guardrails";
import { speak } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Munshi AI" },
      { name: "description", content: "Ask your finance coach anything about your money." },
      { property: "og:title", content: "Coach — Munshi AI" },
      { property: "og:description", content: "Ask your finance coach anything about your money." },
    ],
  }),
  component: Page,
});

type Source = "ai" | "local" | "guardrail";
interface Message {
  role: "user" | "munshi";
  text: string;
  source?: Source;
}

const SUGGESTIONS = [
  "Where did my money go?",
  "Can I afford a ₹40k phone by March?",
  "How much did I spend on Swiggy?",
  "How can I save more?",
  "Am I on track for my goals?",
  "Which stock should I buy?",
];

const GREETING: Message = {
  role: "munshi",
  text: "Namaste! Main Munshi ji. Ask me anything about your money: what you spent, what you can afford, or how your goals are doing. I answer from your own numbers.",
};

function Page() {
  const store = useStore();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  if (store.hydrated && !store.mode) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Munshi needs some numbers first"
        text="Load the demo or add your own income and spends, then ask away."
      />
    );
  }

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = messages.filter((m) => m !== GREETING);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setText("");
    setBusy(true);

    const snapshot = buildSnapshot({
      transactions: store.transactions,
      income: store.profile.income,
      spend: store.spend,
      invested: store.invested,
      fixed: store.fixed.total,
      subscriptions: store.subscriptions,
      goals: store.goals,
    });
    const refuse = () =>
      guardrailAnswer({
        emergencyPct: store.goals.find((g) => g.emergency)?.pct,
        invested: store.invested,
      });

    let reply: Message;
    // Guardrail layer 1: picks are refused here, before anything is sent anywhere.
    if (asksForSecurities(q)) reply = { role: "munshi", text: refuse(), source: "guardrail" };
    else {
      try {
        const res = await askCoach({
          data: {
            question: q,
            history: history.map(({ role, text }) => ({ role, text })),
            snapshot: JSON.stringify(snapshot),
          },
        });
        reply = res.ok
          ? { role: "munshi", text: res.answer, source: "ai" }
          : res.reason === "guardrail"
            ? { role: "munshi", text: refuse(), source: "guardrail" }
            : { role: "munshi", text: answerLocally(q, snapshot), source: "local" };
        if (!res.ok && res.reason === "error") console.warn("Coach AI failed:", res.message);
      } catch (e) {
        console.warn("Coach AI unavailable, answering on-device:", e);
        reply = { role: "munshi", text: answerLocally(q, snapshot), source: "local" };
      }
    }
    setMessages((m) => [...m, reply]);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <MunshiAvatar size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Coach</h1>
          <p className="mt-1 text-muted-foreground">Ask Munshi ji anything about your money.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground sm:self-auto">
          <ShieldCheck className="size-3.5" /> Educational only, not investment advice
        </span>
      </div>

      <section className="card-soft flex min-h-[55vh] flex-col p-4 sm:p-6">
        <ol className="flex-1 space-y-4" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
              {m.role === "munshi" && <MunshiAvatar size="sm" />}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 animate-in fade-in slide-in-from-bottom-1 duration-300",
                )}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {m.role === "munshi" && m.source && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <SourceBadge source={m.source} />
                    <button
                      onClick={() => speak(m.text, { force: true })}
                      aria-label="Read this answer aloud"
                      className="grid size-6 place-items-center rounded-md transition hover:bg-secondary hover:text-foreground"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex gap-3">
              <MunshiAvatar size="sm" />
              <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Munshi ji soch rahe hain…
              </div>
            </li>
          )}
        </ol>
        <div ref={end} />

        {messages.length === 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void ask(s)}
                className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
          className="mt-4 flex items-end gap-2 rounded-2xl border bg-card p-2"
        >
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(text);
              }
            }}
            placeholder="Ask, or dictate with Wispr Flow: “Can I afford a trip to Goa in December?”"
            aria-label="Ask Munshi ji"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Ask"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </form>
      </section>
    </div>
  );
}

function SourceBadge({ source }: { source: Source }) {
  if (source === "guardrail")
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <ShieldCheck className="size-3" /> Guardrail
      </span>
    );
  return source === "ai" ? (
    <span className="inline-flex items-center gap-1">
      <Sparkles className="size-3" /> Gemini
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Zap className="size-3" /> On-device
    </span>
  );
}
