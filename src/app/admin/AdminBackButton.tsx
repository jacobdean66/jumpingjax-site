"use client";

import { useRouter } from "next/navigation";

export function AdminBackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-black leading-tight text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
