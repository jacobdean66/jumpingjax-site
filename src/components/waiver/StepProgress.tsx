"use client";

import type { WaiverFormStep } from "@/lib/waivers/public-form";
import { WAIVER_FORM_STEPS } from "@/lib/waivers/public-form";

const LABELS: Record<(typeof WAIVER_FORM_STEPS)[number], string> = {
  signer: "Signer",
  participants: "Participants",
  legal: "Legal",
  signature: "Sign",
  review: "Review",
};

type StepProgressProps = {
  current: WaiverFormStep;
};

export function WaiverStepProgress({ current }: StepProgressProps) {
  const currentIdx = WAIVER_FORM_STEPS.indexOf(
    current === "submit" ? "review" : current,
  );

  return (
    <nav aria-label="Waiver steps" className="w-full">
      <ol className="flex w-full items-start justify-between gap-1">
        {WAIVER_FORM_STEPS.map((step, index) => {
          const done = index < currentIdx;
          const active = index === currentIdx;
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span
                className={
                  active
                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-sm font-black text-white"
                    : done
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-black text-white"
                      : "flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-sm font-bold text-slate-500"
                }
                aria-current={active ? "step" : undefined}
              >
                {index + 1}
              </span>
              <span
                className={
                  active
                    ? "max-w-full truncate text-center text-[11px] font-bold uppercase tracking-wide text-orange-900"
                    : "max-w-full truncate text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                }
              >
                {LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
