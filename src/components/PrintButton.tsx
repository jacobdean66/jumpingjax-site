"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
    >
      {label}
    </button>
  );
}
