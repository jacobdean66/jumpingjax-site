import { redirect } from "next/navigation";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AdminAuthError } from "@/app/admin/_components";
export const dynamic = "force-dynamic";
export default async function LegacyGmailInbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const query = new URLSearchParams({ account: "gmail" });
  for (const key of ["folder", "id", "connection"] as const) if (typeof params[key] === "string") query.set(key, params[key]);
  redirect("/admin/invoices/inbox?" + query);
}
