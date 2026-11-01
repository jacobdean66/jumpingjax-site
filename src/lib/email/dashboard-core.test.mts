import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyEmailChange, canAccessMailbox, decorateEmail, EMAIL_CATEGORIES, filterEmails, parseWorkflowChange, suggestEmailCategory, workflowPath, type EmailAccount } from "./dashboard-core.ts";
import { gmailMail } from "./gmail-core.ts";

const officeId = "11111111-2222-4333-8444-555555555555";
const base = { account: "office" as const, folder: "inbox" as const, id: officeId, from: "Customer <customer@example.invalid>", to: "info@jumpingjaxllc.com", subject: "New facility booking request", date: "2026-11-01T15:00:00Z", snippet: "", providerUnread: true };
test("operational, financial, promotional and unmatched mail each receive a category", () => {
  const cases = [
    ["New facility booking request", "parties"], ["Rental delivery details", "rentals"], ["Open Play waiver issue", "open_play"],
    ["Question about pricing?", "questions"], ["Reschedule my birthday party", "changes"], ["Invoice #212 – deposit received", "payments"],
    ["Insurance invoice due", "supplies"], ["Equipment order confirmation", "supplies"], ["Partnership opportunity", "marketing"],
    ["Payment failed – shutdown coming soon", "alerts"], ["Water slide sale – limited time", "promotions"], ["A note for Karen", "other"],
  ];
  for (const [subject, expected] of cases) assert.equal(suggestEmailCategory({ subject, from: "sender@example.invalid" }), expected, subject);
  assert.equal(suggestEmailCategory({ subject: "Ready-to-ship products", from: "offers@service.alibaba.com", snippet: "Party rental equipment" }), "promotions");
  assert.equal(EMAIL_CATEGORIES.length, 11);
});
test("saved categories and reply/read states override suggestions without modifying provider data", () => {
  const mail = decorateEmail(base, { category: "questions", status: "waiting", read: true });
  assert.equal(mail.category, "questions"); assert.equal(mail.suggestedCategory, "parties"); assert.equal(mail.manualCategory, true);
  assert.equal(mail.status, "waiting"); assert.equal(mail.unread, false); assert.equal(base.providerUnread, true);
  const auto = applyEmailChange(mail, { account: "office", folder: "inbox", id: officeId, field: "category", value: "auto" });
  assert.equal(auto.category, "parties"); assert.equal(auto.manualCategory, false); assert.equal(auto.status, "waiting");
  const unread = applyEmailChange(auto, { account: "office", folder: "inbox", id: officeId, field: "read", value: false });
  assert.equal(unread.unread, true);
});
test("combined filters preserve account ownership, match all conditions, and sort newest first", () => {
  const office = decorateEmail(base);
  const gmail = decorateEmail({ ...base, account: "gmail", id: "abc123", date: "2026-11-02T15:00:00Z", subject: "Rental request" }, { category: null, status: "needs_reply", read: null });
  const filters = { account: "all" as const, category: "all" as const, status: "all" as const, unread: false, search: "" };
  assert.deepEqual(filterEmails([office, gmail], filters).map(row => row.account), ["gmail", "office"]);
  assert.deepEqual(filterEmails([office, gmail], { ...filters, account: "office" }), [office]);
  assert.deepEqual(filterEmails([office, gmail], { ...filters, category: "rentals", status: "needs_reply", unread: true, search: "CUSTOMER" }), [gmail]);
  assert.equal(filterEmails([office, gmail], { ...filters, category: "parties", status: "needs_reply" }).length, 0);
  assert.notEqual(office.key, gmail.key);
});
test("Gmail unread labels survive metadata decoding", () => {
  assert.equal(gmailMail({ id: "abc123", labelIds: ["INBOX", "UNREAD"] }).unread, true);
  assert.equal(gmailMail({ id: "abc123", labelIds: ["SENT"] }).unread, false);
});
test("workflow patches validate accounts, provider IDs, field values and isolated storage paths", () => {
  const change = { account: "office", folder: "inbox", id: officeId, field: "category", value: "parties" };
  assert.ok(parseWorkflowChange(change));
  for (const invalid of [{ ...change, account: "other" }, { ...change, id: "../../connections" }, { ...change, folder: "trash" }, { ...change, field: "token" }, { ...change, value: "__proto__" }, { ...change, field: "read", value: "true" }, { ...change, field: "status", value: "deleted" }]) assert.equal(parseWorkflowChange(invalid), null);
  assert.notEqual(workflowPath("office", officeId, "category"), workflowPath("office", officeId, "status"));
  assert.notEqual(workflowPath("office", officeId, "read"), workflowPath("gmail", "abc123", "read"));
  assert.throws(() => workflowPath("../connections" as EmailAccount, officeId, "read"));
  assert.equal(applyEmailChange(decorateEmail(base), { account: "gmail", folder: "inbox", id: "abc123", field: "read", value: true }).unread, true);
});
test("employees retain office access while Gmail requires owner access at every endpoint", () => {
  assert.equal(canAccessMailbox("employee", "office"), true); assert.equal(canAccessMailbox("employee", "gmail"), false); assert.equal(canAccessMailbox("owner", "gmail"), true);
  for (const route of ["messages", "message", "workflow"]) {
    const source = readFileSync(new URL(`../../app/api/admin/email/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /await verifyAdminAccess\(\)/); assert.match(source, /canAccessMailbox\(auth.role,/); assert.match(source, /private, no-store/);
  }
  const write = readFileSync(new URL("../../app/api/admin/email/workflow/route.ts", import.meta.url), "utf8");
  assert.ok(write.indexOf("loadEmailDetail(change.account") < write.indexOf("await saveEmailWorkflow"));
  assert.match(write, /request.headers.get\("origin"\) !== request.nextUrl.origin/);
});
