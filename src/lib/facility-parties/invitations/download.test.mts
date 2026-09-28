import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { readInvitationDownload } from "./download.ts";
import { GET } from "../../../app/api/facility/invitations/[id]/editable/route.ts";
import { buildFacilityWaiverInvitationUrl } from "../invitations.ts";
import { resolveEmailSiteUrl } from "../../site-url.ts";

test("failed, empty, or non-file responses cannot be saved as invitation downloads", async () => {
  for (const response of [
    Response.json({ error: "Temporarily unavailable" }, { status: 503 }),
    new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }),
    new Response(null, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" } }),
  ]) await assert.rejects(readInvitationDownload(response));
});

test("saved approved PDF downloads survive the editable route and client file validation", async context => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://approved-download-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  context.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  const bookingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const approvedPrint = {
    version: 1, id: "approved-test", bookingId, childName: "Download Test", childAge: "7",
    customerPhone: "", dateLabel: "2026-10-10", timeLabel: "2–4 PM", themeText: "NASCAR",
    rsvpUrl: buildFacilityWaiverInvitationUrl({ siteUrl: resolveEmailSiteUrl(), bookingId, partyDate: "2026-10-10" }),
  };
  const pdf = "%PDF-1.4\n% isolated saved invitation fixture\n%%EOF";
  let available = true;
  context.mock.method(globalThis, "fetch", async (source: string | URL | Request) => {
    const url = new URL(source instanceof Request ? source.url : source.toString());
    assert.equal(url.hostname, "approved-download-test.supabase.co");
    if (url.pathname === "/rest/v1/facility_bookings") {
      assert.equal(url.searchParams.get("id"), `eq.${bookingId}`);
      return Response.json({ id: bookingId, status: "approved", child_name: approvedPrint.childName, child_age: approvedPrint.childAge, phone: "", readable_date: approvedPrint.dateLabel, readable_time: approvedPrint.timeLabel, party_theme: approvedPrint.themeText, invitation: { approvedPrint }, invitation_quantity: 4 });
    }
    assert.equal(url.pathname, `/storage/v1/object/party-invitation-files/${bookingId}/approved-test.pdf`);
    return available ? new Response(pdf, { headers: { "content-type": "application/pdf" } }) : Response.json({ error: "Unavailable" }, { status: 503 });
  });
  const request = () => GET(new Request("https://site.example/api/download"), { params: Promise.resolve({ id: bookingId }) });
  const { file, fileName } = await readInvitationDownload(await request());
  assert.equal(fileName, "party-invitations-four-per-sheet.pdf");
  assert.equal(await file.text(), pdf);
  available = false;
  const failed = await request();
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("content-disposition"), null);
  await assert.rejects(readInvitationDownload(failed));
  const mismatch = await readInvitationDownload(new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="wrong.pptx"' } }));
  assert.equal(mismatch.fileName, "jumping-jax-invitations.pdf");
});

test("the real download route returns a complete QR file or a retryable error without an attachment", async context => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://download-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  context.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  const bookingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const image = await readFile(new URL("../../../../public/logo.png", import.meta.url));
  let qrAvailable = false;
  let status: string | null = "pending";
  context.mock.method(globalThis, "fetch", async (source: string | URL | Request) => {
    const url = new URL(source instanceof Request ? source.url : source.toString());
    if (url.hostname === "download-test.supabase.co") {
      assert.equal(url.searchParams.get("id"), `eq.${bookingId}`);
      return Response.json({ id: bookingId, status, child_name: "Download Test", child_age: "7", invitation_quantity: 4, party_theme: "Birthday", readable_date: "October 10, 2026", readable_time: "2–4 PM" });
    }
    assert.equal(url.hostname, "api.qrserver.com");
    assert.ok(url.searchParams.get("data")?.includes(bookingId));
    return qrAvailable ? new Response(image, { headers: { "content-type": "image/png" } }) : new Response(null, { status: 503 });
  });
  const download = () => GET(new Request("https://site.example/api/download"), { params: Promise.resolve({ id: bookingId }) });
  const failed = await download();
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("content-disposition"), null);
  assert.match((await failed.json()).error, /try downloading again/i);
  qrAvailable = true;
  const response = await download();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { file, fileName } = await readInvitationDownload(response);
  assert.equal(fileName, "download-test-editable-invitations.pptx");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slide = await zip.file("ppt/slides/slide1.xml")!.async("string");
  assert.equal((slide.match(/Party check-in and guest list QR code/g) || []).length, 4);
  assert.match(await zip.file("ppt/slides/_rels/slide1.xml.rels")!.async("string"), new RegExp(bookingId));
  for (const inactive of ["cancelled", "canceled", " CANCELED ", "rejected", "denied", "unknown", null]) {
    status = inactive;
    const blocked = await download();
    assert.equal(blocked.status, 404);
    assert.equal(blocked.headers.get("content-disposition"), null);
  }
});
