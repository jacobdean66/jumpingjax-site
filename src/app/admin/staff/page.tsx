import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadAdminStaffUsers, type AdminStaffUser } from "@/lib/admin/staff-users";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    message?: string;
    error?: string;
  }>;
};

function StaffForm({
  user,
  token,
}: {
  user: AdminStaffUser;
  token: string;
}) {
  return (
    <form
      action="/api/admin/staff"
      method="post"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="id" value={user.id} />
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            {user.role === "owner" ? "Owner Account" : "Employee Account"}
          </p>
          <h2 className="mt-2 text-2xl font-black">{user.displayName}</h2>
        </div>
        <button className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">
          Save Login
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Display name
          <input
            name="displayName"
            defaultValue={user.displayName}
            required
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Username
          <input
            name="username"
            defaultValue={user.username}
            required
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-2">
          New password
          <input
            name="password"
            type="password"
            placeholder="Leave blank to keep the current password"
            autoComplete="new-password"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm font-bold text-slate-700">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={user.isActive}
          disabled={user.role === "owner"}
          className="mt-1 h-4 w-4"
        />
        Active login
      </label>
    </form>
  );
}

export default async function AdminStaffPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  let users: AdminStaffUser[] = [];
  let loadError: string | null = null;
  try {
    users = await loadAdminStaffUsers();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Staff users could not load";
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Admin" title="Staff Access" />
      <AdminNav token={token} role={auth.role} active="staff" />

      {resolved?.message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-950">
          {resolved.message}
        </div>
      ) : null}
      {(resolved?.error || loadError) ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-950">
          {resolved?.error ?? loadError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        {users.map((user) => (
          <StaffForm key={user.id} user={user} token={token} />
        ))}
      </div>
    </AdminShell>
  );
}
