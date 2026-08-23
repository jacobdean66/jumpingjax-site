import { NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";

import {
  assertAgentDispatchAllowed,
  attachTriggerRun,
  enqueueJob,
} from "@/lib/agent-manager/service";
import {
  isRelevantNominationInbound,
  toNominationEmailEvent,
} from "@/lib/agent-manager/nomination-inbound";
import { triggerNominationInbound } from "@/lib/agent-manager/nomination-trigger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NOMINATION_AGENT_INBOUND_ENABLED !== "1") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Inbound processing is not configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return NextResponse.json({ ok: false, error: "Request body is too large." }, { status: 413 });
  }

  const payload = await request.text();
  const resend = new Resend(apiKey);
  let received: EmailReceivedEvent;
  try {
    const verified = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
    if (verified.type !== "email.received") {
      return NextResponse.json({ ok: true, accepted: false }, { status: 202 });
    }
    received = verified;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  if (!isRelevantNominationInbound({
    emailId: received.data.email_id,
    to: received.data.to,
    subject: received.data.subject,
  }, process.env.NOMINATION_AGENT_INBOUND_RECIPIENT)) {
    return NextResponse.json({ ok: true, accepted: false }, { status: 202 });
  }

  try {
    const { data: email, error } = await resend.emails.receiving.get(received.data.email_id);
    if (error || !email) throw new Error("Received email content is unavailable");

    const event = toNominationEmailEvent(email);
    const job = await enqueueJob({
      agentKey: "nomination",
      jobType: "nomination.email.ingest",
      source: "resend.webhook",
      payload: { sourceEventId: event.sourceEventId, providerEmailId: received.data.email_id },
      idempotencyKey: `email:${event.sourceEventId}`,
      actorId: "resend:webhook",
    });
    await assertAgentDispatchAllowed("nomination");
    const handle = await triggerNominationInbound({
      mode: "production",
      event,
      agentJobId: job.id,
    });
    await attachTriggerRun(job, handle.id);

    return NextResponse.json({ ok: true, accepted: true, runId: handle.id }, { status: 202 });
  } catch (error) {
    console.error("Nomination inbound webhook failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, error: "Nomination event could not be queued." }, { status: 503 });
  }
}
