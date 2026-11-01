export const EMAIL_CATEGORIES = [
  { id: "parties", label: "Facility Parties" },
  { id: "rentals", label: "Rentals & Deliveries" },
  { id: "open_play", label: "Open Play & Waivers" },
  { id: "questions", label: "Customer Questions" },
  { id: "changes", label: "Changes & Cancellations" },
  { id: "payments", label: "Invoices & Payments" },
  { id: "supplies", label: "Supplies & Business Bills" },
  { id: "marketing", label: "Marketing & Partnerships" },
  { id: "alerts", label: "Account & System Alerts" },
  { id: "promotions", label: "Promotions & Newsletters" },
  { id: "other", label: "Other" },
] as const;
export const EMAIL_STATUSES = [
  { id: "none", label: "No reply status" },
  { id: "needs_reply", label: "Needs reply" },
  { id: "waiting", label: "Waiting on customer" },
  { id: "done", label: "Done" },
] as const;
export type EmailCategory = typeof EMAIL_CATEGORIES[number]["id"];
export type EmailStatus = typeof EMAIL_STATUSES[number]["id"];
export type EmailAccount = "office" | "gmail";
export type EmailFolder = "inbox" | "sent";
export type Workflow = { category: EmailCategory | null; status: EmailStatus; read: boolean | null };
export const EMPTY_WORKFLOW: Workflow = { category: null, status: "none", read: null };
export type EmailSummary = {
  key: string; account: EmailAccount; folder: EmailFolder; id: string;
  from: string; to: string; subject: string; date: string; snippet: string;
  suggestedCategory: EmailCategory; category: EmailCategory; manualCategory: boolean;
  status: EmailStatus; unread: boolean;
};
export type EmailDetail = EmailSummary & {
  text: string; document: string; cc?: string; bcc?: string;
  workflowWarning?: string;
  attachments: { name: string; url: string }[];
};
export type EmailAccountInfo = {
  id: EmailAccount; address: string; name: string;
  ready: boolean; needsConnection: boolean; error?: string;
};
export const isEmailAccount = (value: unknown): value is EmailAccount => value === "office" || value === "gmail";
export const isEmailFolder = (value: unknown): value is EmailFolder => value === "inbox" || value === "sent";
export const isEmailCategory = (value: unknown): value is EmailCategory => EMAIL_CATEGORIES.some(row => row.id === value);
export const isEmailStatus = (value: unknown): value is EmailStatus => EMAIL_STATUSES.some(row => row.id === value);
export function canAccessMailbox(role: string, account: EmailAccount): boolean { return account === "office" || role === "owner"; }
export function isEmailId(account: EmailAccount, id: unknown): id is string {
  return typeof id === "string" && (account === "gmail" ? /^[a-f0-9]{1,32}$/i : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(id);
}
export function suggestEmailCategory(mail: { subject: string; from: string; snippet?: string }): EmailCategory {
  const subject = mail.subject.toLowerCase();
  const text = `${subject} ${mail.snippet || ""}`.toLowerCase();
  // Specific operational subjects take priority over generic booking words.
  if (/\b(cancel(?:l?(?:ation|ed|ing))?s?|reschedul\w*|refund|change (my|our|the) (booking|party|rental))\b/.test(text)) return "changes";
  if (/\b(payment failed|shutdown|security alert|verification|verify your|password|suspicious|service alert|deployment failed|account suspended)\b/.test(subject)) return "alerts";
  if (/\b(order (confirmed|confirmation|shipped)|tracking number|insurance|utility bill|equipment order|supplier|business bill)\b/.test(text)) return "supplies";
  if (/\b(invoice|deposit|payment|paid|swipesimple|transaction|balance due|receipt)\b/.test(subject)) return "payments";
  if (/\b(newsletter|sale|discount|limited (time|stock)|price drop|ready-to-ship|hot-selling|featured products|promotion)\b/.test(subject) || /@(?:[^@.]+\.)?alibaba\.com\b/i.test(mail.from)) return "promotions";
  if (/\b(facility|birthday|party booking|party request|guest list|rsvp|party confirmation)\b/.test(text)) return "parties";
  if (/\b(rental|delivery|deliveries|pickup|pick-up|bounce house|water slide|inflatable booking)\b/.test(text)) return "rentals";
  if (/\b(open play|waiver|admission|free pass|day pass)\b/.test(text)) return "open_play";
  if (/\b(partnership|sponsor(ship)?|collaborat\w*|advertis\w*|campaign performance|google ads)\b/.test(text)) return "marketing";
  if (/\b(question|enquiry|inquiry|availability|how much|can (i|we|you)|help|pricing|quote)\b|\?/.test(text)) return "questions";
  if (/@(?:[^@.]+\.)?(google|vercel|supabase)\.com\b/i.test(mail.from)) return "alerts";
  return "other";
}
export function decorateEmail(base: Omit<EmailSummary, "key" | "suggestedCategory" | "category" | "manualCategory" | "status" | "unread"> & { providerUnread: boolean }, workflow: Workflow = EMPTY_WORKFLOW): EmailSummary {
  const { providerUnread, ...fields } = base;
  const suggestedCategory = suggestEmailCategory(base);
  return { ...fields, key: `${base.account}:${base.id}`, suggestedCategory, category: workflow.category ?? suggestedCategory,
    manualCategory: workflow.category !== null, status: workflow.status, unread: workflow.read === null ? providerUnread : !workflow.read };
}
export type WorkflowChange = { account: EmailAccount; folder: EmailFolder; id: string } & (
  { field: "category"; value: EmailCategory | "auto" } | { field: "status"; value: EmailStatus } | { field: "read"; value: boolean }
);
export function parseWorkflowChange(value: unknown): WorkflowChange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isEmailAccount(row.account) || !isEmailFolder(row.folder) || !isEmailId(row.account, row.id)) return null;
  if (row.field === "category" && (row.value === "auto" || isEmailCategory(row.value)) || row.field === "status" && isEmailStatus(row.value) || row.field === "read" && typeof row.value === "boolean") return row as WorkflowChange;
  return null;
}
export function workflowPath(account: EmailAccount, id: string, field: WorkflowChange["field"]): string {
  if (!isEmailAccount(account) || !isEmailId(account, id) || !["category", "status", "read"].includes(field)) throw new Error("Invalid email record.");
  return `email-workflow/v1/${account}/${id}/${field}.json`;
}
export function filterEmails(messages: EmailSummary[], filters: { account: "all" | EmailAccount; category: "all" | EmailCategory; status: "all" | EmailStatus; unread: boolean; search: string }) {
  const search = filters.search.trim().toLowerCase();
  return messages.filter(row => (filters.account === "all" || row.account === filters.account)
    && (filters.category === "all" || row.category === filters.category) && (filters.status === "all" || row.status === filters.status)
    && (!filters.unread || row.unread) && (!search || `${row.subject} ${row.from} ${row.to} ${row.snippet}`.toLowerCase().includes(search)))
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.key.localeCompare(b.key));
}
export function applyEmailChange<T extends EmailSummary>(mail: T, change: WorkflowChange): T {
  if (mail.account !== change.account || mail.id !== change.id) return mail;
  if (change.field === "read") return { ...mail, unread: !change.value };
  if (change.field === "status") return { ...mail, status: change.value };
  return { ...mail, category: change.value === "auto" ? mail.suggestedCategory : change.value, manualCategory: change.value !== "auto" };
}
