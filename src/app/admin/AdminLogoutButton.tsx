"use client";

export function AdminLogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        window.location.href = "/admin";
      }}
      className="inline-flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-bold leading-tight text-slate-700 hover:bg-slate-50"
    >
      Log out
    </button>
  );
}
