/** Pending customers can prepare invitations; RSVP still requires approval. */
export function invitationBookingStatus(value: string | null | undefined): "pending" | "approved" | "confirmed" | null {
  const status = value?.trim().toLowerCase();
  return status === "pending" || status === "approved" || status === "confirmed" ? status : null;
}
