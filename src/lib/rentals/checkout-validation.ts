import { isValidEmailAddress } from "@/lib/email/address";

export type RentalCheckoutStep = 1 | 2 | 3 | 4;
export type CheckoutErrors = Record<string, string>;

type CheckoutDetails = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventAddress: string;
  distanceMiles: string;
  setupSurface: string;
  setupAccess: string;
  setupNotes: string;
  paymentMethod: string;
};

export function rentalStepErrors(
  step: RentalCheckoutStep,
  customer: CheckoutDetails,
  deliveryTime: string,
  eventStartTime: string,
): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (step === 1) {
    if (customer.customerName.trim().length < 2 || customer.customerName.trim().length > 120)
      errors.customerName = "Enter your full name (2–120 characters).";
    if (!isValidEmailAddress(customer.customerEmail) || customer.customerEmail.trim().length > 254)
      errors.customerEmail = "Enter a valid email address, such as you@example.com.";
    const digits = customer.customerPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15 || customer.customerPhone.length > 40)
      errors.customerPhone = "Enter a phone number with 10–15 digits, including the area code.";
  }
  if (step === 2) {
    if (customer.eventAddress.trim().length < 8 || customer.eventAddress.trim().length > 500)
      errors.eventAddress = "Enter the full delivery address, including city and ZIP.";
    else if (!customer.distanceMiles.trim() || !Number.isFinite(Number(customer.distanceMiles)) || Number(customer.distanceMiles) < 0)
      errors.eventAddress = "Select Verify address to confirm your delivery location before continuing.";
    if (!customer.setupSurface.trim()) errors.setupSurface = "Choose the surface where we will set up.";
    if (!customer.setupAccess.trim()) errors.setupAccess = "Choose how we can reach the setup area.";
    if (!customer.setupNotes.trim()) errors.setupNotes = "Enter setup notes, choose No additional notes, or choose Decide later.";
    if (customer.setupNotes.length > 2000) errors.setupNotes = "Shorten your setup notes to 2,000 characters or fewer.";
  }
  if (step === 3) {
    if (eventStartTime !== "Decide later" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(eventStartTime))
      errors.eventStartTime = "Choose your official party start time.";
    if (!deliveryTime.trim()) errors.deliveryTime = "Choose a requested delivery window.";
    if (!customer.paymentMethod.trim()) errors.paymentMethod = "Choose your payment preference.";
  }
  return errors;
}
