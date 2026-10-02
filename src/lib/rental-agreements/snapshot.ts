import { contact } from "@/data/site";
import type { CreateBookingInput } from "@/lib/supabase/booking-data";
import type { RentalAgreementSnapshot, RentalAgreementTemplate } from "./types";

export function buildRentalAgreementSnapshot(input: CreateBookingInput, template: RentalAgreementTemplate): RentalAgreementSnapshot {
  return {
    businessName: "Jumping Jax", businessPhone: contact.phone, businessEmail: contact.email,
    customerName: input.customerName, email: input.email, phone: input.phone,
    items: input.rental_items.map(i => ({ rental_item: i.rental_item, rental_name: i.rental_name ?? i.rental_item })),
    eventDate: input.eventDateYmd, duration: input.durationLabel, foamDuration: input.foamDurationLabel ?? "", spanDays: input.spanDays,
    eventAddress: input.eventAddress, deliveryWindow: input.requested_delivery_window ?? input.delivery_time ?? "To be confirmed",
    eventStartTime: input.event_start_time ?? "To be confirmed", pickup: "Pickup time will be confirmed by Jumping Jax.",
    setupLocation: input.setup_location, setupSurface: input.setup_surface, setupAccess: input.setup_access, setupNotes: input.setup_notes,
    paymentMethod: input.payment_method, subtotal: input.subtotal, deliveryFee: input.delivery_fee, total: input.total,
    paidTotal: 0, balanceDue: input.total, pricingLabel: "Estimated quote — booking and final delivery plan require Jumping Jax confirmation.",
    title: template.title, terms: template.terms, templateVersion: template.version, additionalTerms: "",
  };
}
