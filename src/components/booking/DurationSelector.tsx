"use client";

import type { DurationOption } from "@/lib/mockBooking";

type Props = {
  options: DurationOption[];
  value: string;
  onChange: (id: string) => void;
};

export function DurationSelector({ options, value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              "flex min-h-[4.25rem] flex-col rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
              active
                ? "border-cyan-300/60 bg-cyan-400/15 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
            ].join(" ")}
            aria-pressed={active}
          >
            <span className="text-sm font-black text-white">{opt.label}</span>
            <span className="mt-1 text-xs leading-snug text-slate-400">
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
