import type { AnsweringMachineCall } from "./types";

export type AnsweringMachineBookingRequest = {
  path: "/api/book" | "/api/facility/book";
  body: Record<string, unknown>;
};

function required(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required before creating the booking.`);
  return value.trim();
}

function validEmail(value: string) {
  const email = required(value, "Customer email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid customer email before creating the booking.");
  }
  return email;
}

function timeToMinutes(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("A valid event start time is required before creating the booking.");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildAnsweringMachineBookingRequest(call: AnsweringMachineCall): AnsweringMachineBookingRequest {
  if (!call.transcriptComplete) throw new Error("Finish checking the transcript before creating the booking.");
  if (!call.serviceKind || !call.eventDate) throw new Error("Choose a booking type and event date first.");
  if (call.bookingId) throw new Error(`This call already created booking ${call.bookingId}.`);
  const details = call.bookingDetails;
  const customerName = required(details.customerName, "Customer name");
  const customerEmail = validEmail(details.customerEmail);
  const customerPhone = required(details.customerPhone, "Customer phone");
  const paymentMethod = required(details.paymentMethod, "Payment method");
  const idempotencyKey = `answering-machine:${call.id}`;

  if (call.serviceKind === "rental") {
    if (call.rentalItems.length === 0) throw new Error("Select at least one catalog rental.");
    const eventStartTime = required(details.eventStartTime, "Event start time");
    timeToMinutes(eventStartTime);
    return {
      path: "/api/book",
      body: {
        idempotency_key: idempotencyKey,
        rental_items: call.rentalItems.map((slug) => ({ rental_item: slug })),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        event_date: call.eventDate,
        duration: required(details.duration, "Rental duration"),
        requested_delivery_window: required(details.requestedDeliveryWindow, "Requested delivery window"),
        event_start_time: eventStartTime,
        event_address: required(details.eventAddress, "Event address"),
        distance_miles: details.distanceMiles,
        setup_location: details.eventAddress.trim(),
        setup_surface: required(details.setupSurface, "Setup surface"),
        setup_access: required(details.setupAccess, "Setup access details"),
        setup_notes: details.setupNotes.trim(),
        payment_method: paymentMethod,
        notes: `Created from Answering Machine ${call.callReference}.\n${call.ownerNotes}`.trim(),
      },
    };
  }

  const startMinutes = timeToMinutes(required(call.facilityStartTime ?? "", "Facility start time"));
  const durationMinutes = details.facilityDurationMinutes;
  if (details.facilityPartyKind === "public" && durationMinutes !== 90) {
    throw new Error("Public play parties must use the 90-minute duration.");
  }
  const room = details.facilityPartyKind === "private" ? "room-20" : details.facilityRoom;
  return {
    path: "/api/facility/book",
    body: {
      idempotency_key: idempotencyKey,
      party_kind: details.facilityPartyKind,
      room,
      booking_date: call.eventDate,
      start_minutes: startMinutes,
      end_minutes: startMinutes + durationMinutes,
      customer_name: customerName,
      email: customerEmail,
      phone: customerPhone,
      parent_name: customerName,
      child_name: required(details.childName, "Birthday child name"),
      child_gender: required(details.childGender, "Birthday child gender"),
      child_age: required(details.childAge, "Birthday child age"),
      party_theme: details.partyTheme.trim(),
      balloon_colors: "",
      table_cloth_colors: "",
      drink_choice: required(details.drinkChoice, "Drink choice"),
      payment_method: paymentMethod,
      invitation_delivery_preference: "print",
      invitation_creation_preference: "later",
      invitation_quantity: 0,
      deposit_acknowledged: false,
      notes: `Created from Answering Machine ${call.callReference}.\n${call.ownerNotes}`.trim(),
      addon_selections: [],
    },
  };
}
