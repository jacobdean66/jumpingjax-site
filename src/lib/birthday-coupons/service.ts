import { createHash } from "node:crypto";

import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getResendFromAddress } from "@/lib/email/resend";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isScheduleDue, nextBirthdayCouponSchedule } from "./date";
import { birthdayCouponSubject, birthdayCouponText } from "./email";

const DEFAULT_BATCH_LIMIT = 25;

type WaiverSubmissionJoin = {
  id: string;
  signer_email: string | null;
  signer_first_name: string | null;
  signer_last_name: string | null;
  status: string | null;
};

type WaiverParticipantRow = {
  id: string;
  submission_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: string;
  waiver_submissions: WaiverSubmissionJoin | WaiverSubmissionJoin[] | null;
};

export type BirthdayCouponOutreachRow = {
  id: string;
  waiver_submission_id: string;
  waiver_participant_id: string;
  child_identity_key: string;
  signer_email: string;
  signer_first_name: string | null;
  signer_last_name: string | null;
  child_first_name: string;
  child_last_name: string;
  child_dob: string;
  birthday_year: number;
  birthday_date: string;
  send_on: string;
  coupon_percent: number;
  status: "pending" | "sent" | "failed" | "skipped";
  attempt_count: number;
  last_error: string | null;
  claim_token: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BirthdayCouponRunResult = {
  ok: true;
  dryRun: boolean;
  asOfYmd: string;
  materialized: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeIdentityPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function birthdayCouponIdentityKey(input: {
  signerEmail: string;
  childFirstName: string;
  childLastName: string;
  childDob: string;
}): string {
  return createHash("sha256")
    .update(
      [
        normalizeIdentityPart(input.signerEmail),
        normalizeIdentityPart(input.childFirstName),
        normalizeIdentityPart(input.childLastName),
        input.childDob.trim(),
      ].join("|"),
    )
    .digest("hex");
}

function toOutreachInsert(row: WaiverParticipantRow, asOfYmd: string) {
  const submission = firstRelated(row.waiver_submissions);
  const signerEmail = submission?.signer_email?.trim() ?? "";
  if (!submission || submission.status !== "completed" || !signerEmail) {
    return null;
  }
  const schedule = nextBirthdayCouponSchedule(row.dob, asOfYmd);
  if (!isScheduleDue(schedule, asOfYmd)) return null;

  return {
    waiver_submission_id: row.submission_id,
    waiver_participant_id: row.id,
    child_identity_key: birthdayCouponIdentityKey({
      signerEmail,
      childFirstName: row.first_name,
      childLastName: row.last_name,
      childDob: row.dob,
    }),
    signer_email: signerEmail,
    signer_first_name: submission.signer_first_name,
    signer_last_name: submission.signer_last_name,
    child_first_name: row.first_name,
    child_last_name: row.last_name,
    child_dob: row.dob,
    birthday_year: schedule.birthdayYear,
    birthday_date: schedule.birthdayDate,
    send_on: schedule.sendOn,
    coupon_percent: 20,
    status: "pending",
  };
}

async function loadDueBirthdayCouponInserts(input: {
  supabase: SupabaseClient;
  asOfYmd: string;
}) {
  const pageSize = 1000;
  const inserts: NonNullable<ReturnType<typeof toOutreachInsert>>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await input.supabase
      .from("waiver_participants")
      .select(
        "id, submission_id, first_name, last_name, dob, role, waiver_submissions!inner(id, signer_email, signer_first_name, signer_last_name, status)",
      )
      .eq("role", "child")
      .eq("waiver_submissions.status", "completed")
      .not("waiver_submissions.signer_email", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error("birthday_coupon_waiver_query_failed");

    const rows = data as WaiverParticipantRow[] | null;
    for (const row of rows ?? []) {
      const insert = toOutreachInsert(row, input.asOfYmd);
      if (insert) inserts.push(insert);
    }
    if (!rows || rows.length < pageSize) break;
  }

  return inserts;
}

export async function countDueBirthdayCouponCandidates(input: {
  supabase: SupabaseClient;
  asOfYmd: string;
}): Promise<number> {
  return (await loadDueBirthdayCouponInserts(input)).length;
}

export async function materializeDueBirthdayCouponOutreach(input: {
  supabase: SupabaseClient;
  asOfYmd: string;
}): Promise<number> {
  const inserts = await loadDueBirthdayCouponInserts(input);

  if (inserts.length === 0) return 0;

  const { error: insertError } = await input.supabase
    .from("birthday_coupon_outreach")
    .upsert(inserts, {
      onConflict: "child_identity_key,birthday_year",
      ignoreDuplicates: true,
    });

  if (insertError) throw new Error("birthday_coupon_materialize_failed");
  return inserts.length;
}

export async function claimDueBirthdayCouponOutreach(input: {
  supabase: SupabaseClient;
  asOfYmd: string;
  limit?: number;
}): Promise<BirthdayCouponOutreachRow[]> {
  const { data, error } = await input.supabase.rpc(
    "claim_due_birthday_coupon_outreach",
    {
      p_as_of: input.asOfYmd,
      p_limit: input.limit ?? DEFAULT_BATCH_LIMIT,
      p_lease_seconds: 300,
    },
  );
  if (error) throw new Error("birthday_coupon_claim_failed");
  return (data ?? []) as BirthdayCouponOutreachRow[];
}

async function markSent(supabase: SupabaseClient, row: BirthdayCouponOutreachRow) {
  await supabase.rpc("mark_birthday_coupon_outreach_sent", {
    p_id: row.id,
    p_claim_token: row.claim_token,
  });
}

async function markFailed(
  supabase: SupabaseClient,
  row: BirthdayCouponOutreachRow,
  errorCode: string,
) {
  await supabase.rpc("mark_birthday_coupon_outreach_failed", {
    p_id: row.id,
    p_claim_token: row.claim_token,
    p_error: errorCode,
  });
}

export async function sendClaimedBirthdayCoupon(input: {
  supabase: SupabaseClient;
  row: BirthdayCouponOutreachRow;
  resendApiKey?: string;
  siteUrl?: string;
}): Promise<"sent" | "failed" | "skipped"> {
  if (input.row.status === "sent" || input.row.sent_at) return "skipped";
  if (!input.row.claim_token) {
    await markFailed(input.supabase, input.row, "missing_claim_token");
    return "failed";
  }
  const apiKey = input.resendApiKey ?? process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    await markFailed(input.supabase, input.row, "email_not_configured");
    return "failed";
  }

  const messageKey = `birthday-coupon:${input.row.id}:${input.row.birthday_year}`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: getResendFromAddress(),
        to: input.row.signer_email,
        subject: birthdayCouponSubject({
          childFirstName: input.row.child_first_name,
          couponPercent: input.row.coupon_percent,
        }),
        text: birthdayCouponText({
          childFirstName: input.row.child_first_name,
          couponPercent: input.row.coupon_percent,
          siteUrl: input.siteUrl,
        }),
      },
      { idempotencyKey: messageKey },
    );
    if (error) {
      await markFailed(input.supabase, input.row, "email_delivery_failed");
      return "failed";
    }
    await markSent(input.supabase, input.row);
    return "sent";
  } catch {
    await markFailed(input.supabase, input.row, "email_delivery_failed");
    return "failed";
  }
}

export async function runBirthdayCouponOutreach(input: {
  now?: Date;
  dryRun?: boolean;
  limit?: number;
  siteUrl?: string;
  supabase?: SupabaseClient;
} = {}): Promise<BirthdayCouponRunResult> {
  const supabase = input.supabase ?? createServiceRoleClient();
  const asOfYmd = businessDayYmdFromInstant(input.now ?? new Date());
  const dryRun = input.dryRun === true;
  const errors: string[] = [];

  let materialized = 0;
  let claimed: BirthdayCouponOutreachRow[] = [];
  if (!dryRun) {
    try {
      materialized = await materializeDueBirthdayCouponOutreach({
        supabase,
        asOfYmd,
      });
      claimed = await claimDueBirthdayCouponOutreach({
        supabase,
        asOfYmd,
        limit: input.limit,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "birthday_coupon_run_failed";
      return {
        ok: true,
        dryRun,
        asOfYmd,
        materialized,
        claimed: claimed.length,
        sent: 0,
        failed: 1,
        skipped: 0,
        errors: [code],
      };
    }
  } else {
    try {
      materialized = await countDueBirthdayCouponCandidates({
        supabase,
        asOfYmd,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "birthday_coupon_dry_run_failed");
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of claimed) {
    const outcome = await sendClaimedBirthdayCoupon({
      supabase,
      row,
      siteUrl: input.siteUrl,
    });
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    ok: true,
    dryRun,
    asOfYmd,
    materialized,
    claimed: claimed.length,
    sent,
    failed,
    skipped,
    errors,
  };
}

export async function loadBirthdayCouponAdminRows(input: {
  supabase?: SupabaseClient;
  limit?: number;
} = {}) {
  const supabase = input.supabase ?? createServiceRoleClient();
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const [upcoming, recent] = await Promise.all([
    supabase
      .from("birthday_coupon_outreach")
      .select("*")
      .in("status", ["pending", "failed"])
      .order("send_on", { ascending: true })
      .limit(limit),
    supabase
      .from("birthday_coupon_outreach")
      .select("*")
      .in("status", ["sent", "failed", "skipped"])
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);
  if (upcoming.error || recent.error) {
    throw new Error("birthday_coupon_admin_load_failed");
  }
  return {
    upcoming: (upcoming.data ?? []) as BirthdayCouponOutreachRow[],
    recent: (recent.data ?? []) as BirthdayCouponOutreachRow[],
  };
}
