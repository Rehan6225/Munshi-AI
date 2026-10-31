import { Volume2, VolumeX, X } from "lucide-react";
import type { ReactNode } from "react";
import { setMuted, stopSpeaking, useSpeech } from "@/lib/speech";
import type { MunshiReply } from "@/lib/munshi";
import { cn } from "@/lib/utils";

/** Munshi ji at her ledger; pulses while she's talking. */
export function MunshiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { speaking } = useSpeech();
  const box = { sm: "size-8", md: "size-10", lg: "size-14" }[size];
  // Small avatars show her face, which stays readable at 32px. She writes in her ledger on the
  // big ones and whenever she's talking; the rest hold still so a chat isn't all motion.
  const src =
    size === "sm"
      ? "/munshi-ji-face.svg"
      : size === "lg" || speaking
        ? "/munshi-ji.svg"
        : "/munshi-ji-still.svg";
  return (
    <span className="relative inline-grid shrink-0" aria-hidden>
      {speaking && (
        <span className={cn("absolute inset-0 animate-ping rounded-full bg-primary/40", box)} />
      )}
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          "relative rounded-full shadow-glow ring-1 ring-primary/30 transition",
          box,
          speaking && "scale-105",
        )}
      />
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
