export function getFacilityOwnerEmail(): string {
  return (
    process.env.FACILITY_OWNER_EMAIL?.trim() ||
    "jacobdean1166@gmail.com"
  );
}

export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Jumping Jax <onboarding@resend.dev>"
  );
}
