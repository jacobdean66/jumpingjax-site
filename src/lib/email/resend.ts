export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Jumping Jax <onboarding@resend.dev>"
  );
}
