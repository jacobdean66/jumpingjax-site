// Shared with the facility booking form and receptionist terms response.
// These describe the local website build; deployment is verified separately.
export const FACILITY_DEPOSIT_CENTS = 5000;
const depositDeadline = "within one week of making the reservation";
export const FACILITY_DEPOSIT_DUE = `Due ${depositDeadline}; pay Jumping Jax directly.`;
export const FACILITY_BALANCE_DUE = "The team can confirm the remaining balance and payment arrangements.";
export const FACILITY_DEPOSIT_ACKNOWLEDGMENT =
  `I understand the $${FACILITY_DEPOSIT_CENTS / 100} deposit is due ${depositDeadline} and can be paid directly to Jumping Jax.`;
