import { verifyAdminAccess } from "@/lib/admin/session";
import { loadAdminTaskAutomation } from "@/lib/admin/task-automation";
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
    from?: string;
    to?: string;
  }>;
};

const CATEGORY_ORDER = [
  "Daily delivery checklist",
  "Missing payment/deposit",
  "Unconfirmed booking reminder",
  "Inventory prep list",
  "Driver assignment reminder",
  "End-of-day pickup completion",
];

export default async function AdminTasksPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess();

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const { from, to, tasks } = await loadAdminTaskAutomation({
    from: resolved?.from,
    to: resolved?.to,
  });

  return (
    <AdminShell>
      <AdminHeader eyebrow="Operations" title="Daily Tasks" />
      <AdminNav token={token} role={auth.role} active="tasks" />

      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="token" value={token} />
        <label className="text-sm font-bold text-slate-700">
          From
          <input name="from" type="date" defaultValue={from} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          To
          <input name="to" type="date" defaultValue={to} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" />
        </label>
        <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white">
          Load Tasks
        </button>
      </form>

      <div className="mt-6 grid gap-5">
        {CATEGORY_ORDER.map((category) => {
          const categoryTasks = tasks.filter((task) => task.category === category);
          return (
            <section key={category} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <h2 className="text-xl font-black">{category}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {categoryTasks.length}
                </span>
              </div>
              {categoryTasks.length === 0 ? (
                <p className="mt-4 text-sm font-semibold text-slate-500">
                  No tasks in this category.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {categoryTasks.map((task, index) => (
                    <article key={`${category}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                            {task.due} - {task.owner}
                          </p>
                          <h3 className="mt-1 text-lg font-black">{task.customer}</h3>
                        </div>
                        <span className={task.priority === "High" ? "rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700" : "rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700"}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700">{task.detail}</p>
                      <p className="mt-2 text-sm text-slate-600">{task.action}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
