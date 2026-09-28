/** Read the public booking response without hiding validation or retry guidance. */
export async function readFacilityBookingResponse(response: Response): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  const payload = data && typeof data === "object"
    ? data as { id?: unknown; error?: unknown }
    : null;

  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    const wait = Number.isFinite(seconds) && seconds > 0
      ? `Please wait ${Math.ceil(seconds / 60)} minute(s) before trying again.`
      : "Please wait before trying again.";
    throw new Error(`Too many booking attempts. ${wait} Your details are still here.`);
  }
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error
        : "We could not submit your booking request. Please try again.",
    );
  }
  if (typeof payload?.id !== "string" || !payload.id.trim()) {
    throw new Error("We could not confirm whether your request was saved. Please contact Jumping Jax before submitting again.");
  }
  return payload.id;
}
