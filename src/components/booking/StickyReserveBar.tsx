"use client";

type Props = {
  totalDisplay: string | null;
  disabledReason?: string;
  formId?: string;
  submitDisabled?: boolean;
};

export function StickyReserveBar({
  totalDisplay,
  disabledReason,
  formId = "booking-form",
  submitDisabled = false,
}: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6"
      role="region"
      aria-label="Reserve"
    >
      <div className="flex w-full max-w-4xl items-center gap-3 rounded-2xl border border-white/15 bg-[#071326]/92 px-3 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:gap-4 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Estimated total
          </p>
          <p className="truncate text-xl font-black tabular-nums text-cyan-300 sm:text-2xl">
            {totalDisplay ?? "—"}
          </p>
          {disabledReason && (
            <p className="mt-0.5 line-clamp-2 text-[0.7rem] text-amber-200/90 sm:text-xs">
              {disabledReason}
            </p>
          )}
        </div>
        <button
          type="submit"
          form={formId}
          disabled={submitDisabled}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-black shadow-lg shadow-cyan-950/25 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 sm:px-8 sm:text-base"
        >
          Submit request
        </button>
      </div>
    </div>
  );
}
