import { NextResponse } from "next/server";

import { InMemoryAuditLog } from "@/lib/ai-receptionist/audit";
import { SimEmailAdapter } from "@/lib/ai-receptionist/adapters/email";
import { SimSmsAdapter } from "@/lib/ai-receptionist/adapters/sms";
import {
  buildCandidateFromWaiverRow,
} from "@/lib/ai-receptionist/birthday/eligibility";
import { runBirthdayOfferDryRun } from "@/lib/ai-receptionist/birthday/scheduler";
import {
  sanitizeAuditForOwnerDemo,
  sanitizeEmailLedger,
  sanitizeSmsLedger,
} from "@/lib/ai-receptionist/sanitize";
import {
  getForcedSimulationConfig,
  SIMULATION_BANNER,
} from "@/lib/ai-receptionist/simulation-mode";
import type {
  BirthdayExclusion,
  MarketingContactSnapshot,
  PriorBirthdayDelivery,
} from "@/lib/ai-receptionist/types";
import { requireOwnerAuth } from "@/lib/open-play/staff-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Body = {
  todayYmd?: string;
  candidates?: Array<{
    participantId: string;
    submissionId: string;
    childFirstName: string;
    childLastName: string;
    childDobYmd: string;
    signerEmail: string;
    signerPhone: string;
    signerFirstName: string;
    signerLastName: string;
    waiverExpiresOn: string;
  }>;
  contacts?: MarketingContactSnapshot[];
  contactIdBySignerKey?: Record<string, string>;
  exclusions?: BirthdayExclusion[];
  priorDeliveries?: PriorBirthdayDelivery[];
};

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "ai-receptionist-simulate-birthday",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const config = getForcedSimulationConfig();
  const todayYmd = body.todayYmd?.trim();
  if (!todayYmd || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return NextResponse.json(
      { ok: false, error: "todayYmd (YYYY-MM-DD) is required for dry-run" },
      { status: 400 },
    );
  }

  const candidates = (body.candidates ?? []).map((row) =>
    buildCandidateFromWaiverRow({
      ...row,
      todayYmd,
      weeksBefore: config.birthdayWeeksBefore,
    }),
  );

  const contactsById = new Map(
    (body.contacts ?? []).map((contact) => [contact.id, contact]),
  );
  const contactIdBySignerKey = new Map(
    Object.entries(body.contactIdBySignerKey ?? {}),
  );

  const audit = new InMemoryAuditLog();
  const sms = new SimSmsAdapter(config);
  const email = new SimEmailAdapter(config);

  const result = await runBirthdayOfferDryRun(
    { config, audit, sms, email },
    {
      todayYmd,
      candidates,
      contactsById,
      contactIdBySignerKey,
      exclusions: body.exclusions ?? [],
      priorDeliveries: body.priorDeliveries ?? [],
    },
  );

  return NextResponse.json({
    ok: true,
    banner: SIMULATION_BANNER,
    liveActions: false,
    note: "Dry-run only. Deliveries are simulated; no real customer communications are sent.",
    todayYmd: result.todayYmd,
    ledger: result.ledger,
    results: result.results.map((row) => ({
      participantId: row.participantId,
      childFingerprint: row.childFingerprint,
      decision: row.decision,
      messageId: row.messageId,
      ledger: row.ledger,
    })),
    smsLedger: sanitizeSmsLedger(sms.listSent()),
    emailLedger: sanitizeEmailLedger(email.listSent()),
    audit: sanitizeAuditForOwnerDemo(audit.list()),
  });
}
