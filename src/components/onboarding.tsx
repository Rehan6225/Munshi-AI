import { Mic, Radar, Target, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { MunshiAvatar } from "./munshi";

const FEATURES = [
  {
    icon: Mic,
    title: "Just say it",
    text: "“Spent 480 on Swiggy last night” — logged, categorised, done.",
  },
  {
    icon: Radar,
    title: "Catches leaks",
    text: "Forgotten subscriptions, sneaky price hikes and wrong categories.",
  },
  {
    icon: Target,
    title: "Goals that talk back",
    text: "Know early when your emergency fund is slipping — and how to fix it.",
  },
];

export function Onboarding() {
  const { loadDemo, startOwn } = useStore();
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-[-20%] h-[600px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto flex max-w-5xl flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center gap-2.5">
          <MunshiAvatar size="sm" />
          <span className="text-lg font-semibold tracking-tight">Munshi AI</span>
        </div>

        <section className="mx-auto mt-20 max-w-3xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700 sm:mt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Munshi ji · your
            personal accountant
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-7xl">
            Talk to your <span className="text-primary">money.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Say what you spent the way you'd tell a friend. Munshi ji keeps the books, talks back
            and tells you what to do next.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={loadDemo}
              className="group inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Try with demo data
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => {
                startOwn();
                void navigate({ to: "/profile" });
              }}
              className="inline-flex items-center gap-2 rounded-2xl border px-6 py-3.5 font-medium transition hover:bg-secondary"
            >
              Start with my own numbers
            </button>
          </div>
        </section>

        <section className="mt-24 grid gap-5 pb-12 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card-soft p-6 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700"
              style={{ animationDelay: `${200 + i * 120}ms` }}
            >
              <div className="grid size-11 place-items-center rounded-xl bg-accent">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-5 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
