/** Preview uploads must not populate the live invitation artwork store. */
export function invitationArtworkBucket(): string {
  return process.env.VERCEL_ENV === "preview" ? "invitation-theme-artwork-preview" : "invitation-theme-artwork";
}
