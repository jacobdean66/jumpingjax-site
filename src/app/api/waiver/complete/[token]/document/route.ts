import { getCompletionByToken, WaiverSubmitError } from "@/lib/waivers/submit";
import {
  getSignedGroupRecord,
  signedRecordResponse,
} from "@/lib/waivers/group-record";
import { publicSafeError } from "@/lib/open-play/staff-auth";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const limited = rateLimit(req, {
    scope: "waiver-copy",
    limit: 60,
    windowMs: 3600000,
  });
  if (limited) return limited;
  const { token } = await context.params;
  if (token.length < 32 || token.length > 128)
    return publicSafeError("not_found", 404, "Waiver copy not found");
  try {
    const completion = await getCompletionByToken({ token });
    if (!completion || completion.status !== "completed")
      return publicSafeError("not_found", 404, "Waiver copy not found");
    const record = await getSignedGroupRecord(completion.submissionId);
    if (!record)
      return publicSafeError("not_found", 404, "Waiver copy not available");
    return signedRecordResponse(
      record,
      new URL(req.url).searchParams.get("download") === "1",
    );
  } catch (error) {
    if (error instanceof WaiverSubmitError && error.code === "token_expired")
      return publicSafeError(
        "token_expired",
        410,
        "This download link expired. Contact Jumping Jax for your copy.",
      );
    return publicSafeError("database", 503);
  }
}
