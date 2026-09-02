const GENERIC_RETRYABLE_JOB_TYPES = new Set([
  "system.health_check",
  "booking.workflow.triage",
  "booking.follow_up.review",
  "waiver.submission.triage",
  "code.health.diagnosis",
]);

export function isGenericRetryableJobType(jobType: string): boolean {
  return GENERIC_RETRYABLE_JOB_TYPES.has(jobType);
}
