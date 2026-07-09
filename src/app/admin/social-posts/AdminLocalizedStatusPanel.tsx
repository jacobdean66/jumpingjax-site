"use client";

type Tone = "error" | "warning" | "info";

const TONE_STYLES: Record<Tone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

type Props = {
  tone?: Tone;
  title?: string;
  message: string;
  onDismiss?: () => void;
};

export default function AdminLocalizedStatusPanel({
  tone = "error",
  title,
  message,
  onDismiss,
}: Props) {
  if (!message.trim()) return null;

  return (
    <div
      className={`rounded-xl border p-3 text-sm ${TONE_STYLES[tone]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1 font-semibold" : "font-bold"}>{message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-xs font-black uppercase tracking-wide"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
