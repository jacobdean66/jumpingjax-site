import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { readInvitationDownload } from "./download.ts";
import { GET } from "../../../app/api/facility/invitations/[id]/editable/route.ts";

test("failed, empty, or non-file responses cannot be saved as invitation downloads", async () => {
  for (const response of [
    Response.json({ error: "Temporarily unavailable" }, { status: 503 }),
    new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }),
    new Response(null, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" } }),
  ]) await assert.rejects(readInvitationDownload(response));
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
