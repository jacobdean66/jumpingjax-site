"use client";

export function AdminLogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        window.location.href = "/admin";
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold leading-tight text-slate-700 hover:bg-slate-50"
    >
      Log out
    </button>
  );
}
