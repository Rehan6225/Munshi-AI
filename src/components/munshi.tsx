import { NotebookPen, Volume2, VolumeX, X } from "lucide-react";
import type { ReactNode } from "react";
import { setMuted, setVoiceChoice, stopSpeaking, useSpeech } from "@/lib/speech";
import type { MunshiReply } from "@/lib/munshi";
import { cn } from "@/lib/utils";

/** Munshi ji: a ledger-and-pen mark that glows and pulses while he's talking. */
export function MunshiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { speaking } = useSpeech();
  const box = { sm: "size-8 rounded-xl", md: "size-10 rounded-xl", lg: "size-14 rounded-2xl" }[
    size
  ];
  const icon = { sm: "size-4", md: "size-5", lg: "size-7" }[size];
  return (
    <span className="relative inline-grid shrink-0" aria-hidden>
      {speaking && <span className={cn("absolute inset-0 animate-ping bg-primary/40", box)} />}
      <span
        className={cn(
          "relative grid place-items-center bg-gradient-to-br from-primary to-emerald-700 text-primary-foreground shadow-glow transition",
          box,
          speaking && "scale-105",
        )}
      >
        <NotebookPen className={icon} />
      </span>
    </span>
  );
}

/** What Munshi says back after a voice command. */
export function MunshiBubble({
  reply,
  onClose,
  children,
}: {
  reply: MunshiReply;
  onClose: () => void;
  /** Extra buttons, e.g. "Cancel it" after "I don't use Hotstar". */
  children?: ReactNode;
}) {
  const { speaking } = useSpeech();
  return (
    <div
      role="status"
      className="mb-2 flex items-start gap-3 rounded-2xl border bg-card p-3 pr-2 shadow-glow animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <MunshiAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground">
          Munshi ji{speaking && <span className="ml-1.5 text-primary">· bol rahe hain…</span>}
        </p>
        <p className="mt-0.5 text-[15px] leading-relaxed">{reply.text}</p>
        {reply.aside && <p className="mt-1 text-sm text-muted-foreground">{reply.aside.text}</p>}
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </div>
      <button
        onClick={() => {
          stopSpeaking();
          onClose();
        }}
        aria-label="Dismiss"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function MuteButton({ className }: { className?: string }) {
  const { muted, supported } = useSpeech();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Let Munshi speak" : "Mute Munshi"}
      title={muted ? "Munshi is muted" : "Munshi speaks his replies"}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
    </button>
  );
}

/** EN = Indian-English voice (default), हि = Hindi voice. Only shown when the device has one. */
export function VoiceToggle({ className }: { className?: string }) {
  const { voice, hindiAvailable, muted } = useSpeech();
  if (!hindiAvailable || muted) return null;
  return (
    <button
      type="button"
      onClick={() => setVoiceChoice(voice === "en" ? "hi" : "en")}
      aria-label={
        voice === "en" ? "Switch Munshi to a Hindi voice" : "Switch Munshi to an English voice"
      }
      title={voice === "en" ? "Munshi speaks Indian English" : "Munshi speaks Hindi"}
      className={cn(
        "grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {voice === "en" ? "EN" : "हि"}
    </button>
  );
}
