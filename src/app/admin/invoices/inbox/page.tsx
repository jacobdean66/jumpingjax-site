import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminAccess } from "@/lib/admin/session";
import { gmailConnected } from "@/lib/email/gmail-inbox";
import { KAREN_GMAIL } from "@/lib/email/gmail-core";
import { officeAddress } from "@/lib/email/office-inbox";
import { isEmailAccount, isEmailId, type EmailAccountInfo } from "@/lib/email/dashboard-core";
import { EmailDashboard } from "./EmailDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email | Jumping Jax", robots: { index: false, follow: false } };
const connectionMessages: Record<string, string> = {
  connected: "Karen’s Gmail is connected. Your inboxes are below.",
  cancelled: "Google connection was cancelled. You can connect Karen’s Gmail below when ready.",
  invalid_state: "The connection request expired. Select Connect Gmail to try again.",
  configuration_required: "The Google connection needs attention from the site administrator.",
  authorization_failed: "Gmail could not be connected. Choose Karen’s account and approve email viewing. The Google app must have the Gmail API enabled.",
};
export default async function EmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const officeReady = Boolean(process.env.RESEND_INBOX_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim());
  const accounts: EmailAccountInfo[] = [{ id: "office", address: officeAddress(), name: "Office email", ready: officeReady, needsConnection: false,
    ...(!officeReady ? { error: "Office email setup needs attention from the site administrator." } : {}) }];
  if (auth.role === "owner") {
    try {
      const ready = await gmailConnected();
      accounts.push({ id: "gmail", address: KAREN_GMAIL, name: "Karen’s Gmail", ready, needsConnection: !ready });
    } catch { accounts.push({ id: "gmail", address: KAREN_GMAIL, name: "Karen’s Gmail", ready: false, needsConnection: false, error: "The saved Gmail connection could not be checked. Refresh to try again." }); }
  }
  const account = isEmailAccount(params.account) && accounts.some(row => row.id === params.account) ? params.account : "all";
  const folder = params.folder === "sent" ? "sent" : "inbox";
  const id = typeof params.id === "string" && isEmailId(account === "gmail" ? "gmail" : "office", params.id) ? params.id : "";
  const connectionMessage = typeof params.connection === "string" && Object.hasOwn(connectionMessages, params.connection) ? connectionMessages[params.connection] : "";
  return <AdminShell><AdminHeader eyebrow="Office email" title="Email"><AdminNav token="" role={auth.role} active="invoices" /></AdminHeader>
    <EmailDashboard accounts={accounts} initialAccount={account} initialFolder={folder} initialId={id} connectionMessage={connectionMessage} />
  </AdminShell>;
}
