import Link from "next/link";
import { AdminBackButton } from "@/app/admin/AdminBackButton";
import { AdminTokenGate } from "@/app/admin/AdminTokenGate";
import { PaymentHub } from "@/components/payments/PaymentHub";
import { verifyAdminAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-rose-700">Jumping Jax Admin</p>
          <h1 className="mt-3 text-3xl font-black">Staff sign in</h1>
          {auth.reason === "invalid_token" ? <div className="mt-6"><AdminTokenGate /></div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <AdminBackButton />
          <div className="flex flex-wrap gap-2">
            <Link
              href="https://swipesimple.com/transactions"
              target="_blank"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black hover:bg-slate-50"
            >
              Transaction history
            </Link>
            <Link
              href="https://swipesimple.com/companies/428590/reporting?topic=transaction"
              target="_blank"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Daily reports
            </Link>
          </div>
        </div>
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PaymentHub />
        </section>
        <section className="mt-6 border-l-4 border-amber-400 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">
          <h2 className="font-black text-slate-950">Front-counter recordkeeping</h2>
          <p className="mt-2">
            SwipeSimple records every swipe, tap, keyed sale, cash sale, refund,
            and adjustment. Use Transaction History or Daily Reports for the live
            official total. The Jumping Jax site cannot automatically read those
            transactions until SwipeSimple grants API or webhook access.
          </p>
        </section>
      </div>
    </main>
  );
}
