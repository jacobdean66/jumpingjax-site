"use client";

import { useRouter } from "next/navigation";

export function AdminBackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
