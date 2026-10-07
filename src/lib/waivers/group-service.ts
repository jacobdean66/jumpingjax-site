import { createServiceRoleClient } from "../supabase/admin";
import { toStaffSearchResult, type StaffSearchResult } from "./search";
import { isWaiverExpired } from "./expiration";
import { ageInCompletedYearsOnDate } from "../open-play/pricing";
import { businessDayYmdFromInstant } from "../open-play/business-day";

export async function getWaiverGroupForStaff(
  submissionId: string,
): Promise<StaffSearchResult[] | null> {
  const db = createServiceRoleClient();
  const { data: s, error } = await db
    .from("waiver_submissions")
    .select(
      "id,template_id,template_version_id,signer_first_name,signer_last_name,expires_on,status",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error("Unable to load waiver group");
  if (!s) return null;
  const { data: template, error: templateError } = await db
    .from("waiver_templates")
    .select("required_version_id")
    .eq("id", s.template_id)
    .single();
  if (templateError) throw new Error("Unable to load waiver requirements");
  let requiresRenewal = false;
  if (template.required_version_id) {
    const { data: versions, error: versionError } = await db
      .from("waiver_template_versions")
      .select("id,version_number")
      .in("id", [s.template_version_id, template.required_version_id]);
    if (versionError) throw new Error("Unable to load waiver versions");
    const signed = versions?.find(
      (v) => v.id === s.template_version_id,
    )?.version_number;
    const required = versions?.find(
      (v) => v.id === template.required_version_id,
    )?.version_number;
    requiresRenewal =
      signed === undefined || required === undefined || signed < required;
  }
  const { data: rows, error: rowError } = await db
    .from("waiver_participants")
    .select("id,first_name,last_name,dob,role,created_at")
    .eq("submission_id", submissionId)
    .order("created_at")
    .order("id");
  if (rowError) throw new Error("Unable to load group members");
  const ids = (rows ?? []).map((p) => p.id);
  const { data: changes, error: changeError } = ids.length
    ? await db
        .from("waiver_participant_name_corrections")
        .select(
          "participant_id,corrected_first_name,corrected_last_name,created_at,id",
        )
        .in("participant_id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
    : { data: [], error: null };
  if (changeError) throw new Error("Unable to load corrected names");
  const { data: agreements, error: agreementError } = await db
    .from("waiver_adult_agreements")
    .select("participant_id,adult_mode")
    .eq("submission_id", submissionId);
  if (agreementError) throw new Error("Unable to load adult attendance");
  const today = businessDayYmdFromInstant(new Date());
  return (rows ?? [])
    .map((p) => {
      const correction = changes?.find((c) => c.participant_id === p.id);
      const age = ageInCompletedYearsOnDate(p.dob, today);
      return {
        ...toStaffSearchResult({
          participantId: p.id,
          submissionId: s.id,
          firstName: correction?.corrected_first_name ?? p.first_name,
          lastName: correction?.corrected_last_name ?? p.last_name,
          originalFirstName: p.first_name,
          originalLastName: p.last_name,
          nameCorrected: !!correction,
          dob: p.dob,
          role: p.role,
          expiresOnYmd: s.expires_on,
          expired:
            requiresRenewal ||
            s.status !== "completed" ||
            isWaiverExpired({
              expiresOnYmd: s.expires_on,
              evaluationLocalYmd: today,
            }) ||
            (p.role === "child" && age >= 18),
          signerFirstName: s.signer_first_name,
          signerLastName: s.signer_last_name,
        }),
      ageYears: age,
      dobYmd: p.dob,
        adultMode:
          agreements?.find((a) => a.participant_id === p.id)?.adult_mode ??
          null,
      };
    })
    .sort(
      (a, b) =>
        (a.role === "adult_signer" ? -1 : a.role === "child" ? 1 : 0) -
        (b.role === "adult_signer" ? -1 : b.role === "child" ? 1 : 0),
    );
}
