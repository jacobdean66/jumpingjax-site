"use client";

export function AdminLogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        window.location.href = "/admin";
      }}
      className={compact
        ? "inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-[11px] font-bold leading-tight text-slate-700 hover:bg-slate-50"
        : "inline-flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-bold leading-tight text-slate-700 hover:bg-slate-50"}
    >
      Log out
    </button>
  );
}
