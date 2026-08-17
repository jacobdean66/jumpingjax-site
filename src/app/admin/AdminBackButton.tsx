"use client";

import { useRouter } from "next/navigation";

export function AdminBackButton({ label = "Back", compact = false }: { label?: string; compact?: boolean }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={compact
        ? "inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-[11px] font-black leading-tight text-slate-700 hover:bg-slate-50"
        : "inline-flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-black leading-tight text-slate-700 hover:bg-slate-50"}
    >
      {label}
    </button>
  );
}
