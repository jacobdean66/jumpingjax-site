import {
  normalizeRentalStatus,
  rentalAppearsInActiveSchedule,
} from "@/lib/bookings/rental-lifecycle";
import {
  normalizeInvitationDeliveryPreferences,
  normalizeInvitationTemplateId,
  type FacilityInvitationDeliveryPreference,
  type FacilityInvitationTemplateId,
} from "@/lib/facility-parties/invitations";

export const FACILITY_EDITABLE_STATUSES = ["pending", "confirmed"] as const;

const FACILITY_EDITABLE_STATUS_SET = new Set<string>(FACILITY_EDITABLE_STATUSES);

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function rentalBookingIsEditable(
  status: string | null | undefined,
): boolean {
  return rentalAppearsInActiveSchedule(status);
}

export function facilityBookingIsEditable(
  status: string | null | undefined,
): boolean {
  return FACILITY_EDITABLE_STATUS_SET.has(
    normalizeRentalStatus(status),
  );
}

export function isValidBookingId(id: string): boolean {
  return /^[0-9a-z-]{1,128}$/i.test(id);
}

export function isValidYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return (
    date.getFullYear() === y &&
    date.getMonth() === (m ?? 1) - 1 &&
    date.getDate() === d
  );
}

export function isValidClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function requiredTrimmed(
  value: unknown,
  field: string,
  max: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} is required.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${field} is required.` };
  }
  if (trimmed.length > max) {
    return { ok: false, error: `${field} is too long.` };
  }
  return { ok: true, value: trimmed };
}

function optionalTrimmed(
  value: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be text.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return { ok: false, error: `${field} is too long.` };
  }
  return { ok: true, value: trimmed || null };
}

export type RentalEditInput = {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  eventDate: string;
  eventStartTime: string | null;
  requestedDeliveryWindow: string | null;
  eventAddress: string;
  setupLocation: string | null;
  setupSurface: string | null;
  setupAccess: string | null;
  setupNotes: string | null;
  paymentMethod: string;
};

export type FacilityEditInput = {
  customerName: string;
  email: string | null;
  phone: string | null;
  parentName: string | null;
  childName: string | null;
  childAge: string | null;
  childGender: string | null;
  partyTheme: string | null;
  invitationDeliveryPreferences: FacilityInvitationDeliveryPreference[];
  invitationTemplateId: FacilityInvitationTemplateId;
  balloonColors: string | null;
  tableClothColors: string | null;
  drinkChoice: string | null;
  notes: string | null;
  paymentMethod: string;
};

export function parseRentalEditInput(
  body: unknown,
): { ok: true; value: RentalEditInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const raw = body as Record<string, unknown>;

  const customerName = requiredTrimmed(raw.customerName, "Customer name", 120);
  if (!customerName.ok) return customerName;

  const customerEmail = optionalTrimmed(raw.customerEmail, "Email", 200);
  if (!customerEmail.ok) return customerEmail;
  if (
    customerEmail.value &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.value)
  ) {
    return { ok: false, error: "Email looks invalid." };
  }

  const customerPhone = optionalTrimmed(raw.customerPhone, "Phone", 40);
  if (!customerPhone.ok) return customerPhone;

  const eventDate = requiredTrimmed(raw.eventDate, "Event date", 10);
  if (!eventDate.ok) return eventDate;
  if (!isValidYmd(eventDate.value)) {
    return { ok: false, error: "Event date must be YYYY-MM-DD." };
  }

  const eventStartTime = optionalTrimmed(
    raw.eventStartTime,
    "Event start time",
    20,
  );
  if (!eventStartTime.ok) return eventStartTime;
  if (eventStartTime.value && !isValidClockTime(eventStartTime.value)) {
    return { ok: false, error: "Event start time must be HH:MM." };
  }

  const requestedDeliveryWindow = optionalTrimmed(
    raw.requestedDeliveryWindow,
    "Delivery window",
    80,
  );
  if (!requestedDeliveryWindow.ok) return requestedDeliveryWindow;

  const eventAddress = requiredTrimmed(raw.eventAddress, "Address", 300);
  if (!eventAddress.ok) return eventAddress;

  const setupLocation = optionalTrimmed(
    raw.setupLocation,
    "Setup location",
    120,
  );
  if (!setupLocation.ok) return setupLocation;

  const setupSurface = optionalTrimmed(raw.setupSurface, "Setup surface", 120);
  if (!setupSurface.ok) return setupSurface;

  const setupAccess = optionalTrimmed(raw.setupAccess, "Setup access", 200);
  if (!setupAccess.ok) return setupAccess;

  const setupNotes = optionalTrimmed(raw.setupNotes, "Setup notes", 2000);
  if (!setupNotes.ok) return setupNotes;

  const paymentMethod = requiredTrimmed(
    raw.paymentMethod,
    "Payment method",
    80,
  );
  if (!paymentMethod.ok) return paymentMethod;

  return {
    ok: true,
    value: {
      customerName: customerName.value,
      customerEmail: customerEmail.value,
      customerPhone: customerPhone.value,
      eventDate: eventDate.value,
      eventStartTime: eventStartTime.value,
      requestedDeliveryWindow: requestedDeliveryWindow.value,
      eventAddress: eventAddress.value,
      setupLocation: setupLocation.value,
      setupSurface: setupSurface.value,
      setupAccess: setupAccess.value,
      setupNotes: setupNotes.value,
      paymentMethod: paymentMethod.value,
    },
  };
}

export function parseFacilityEditInput(
  body: unknown,
): { ok: true; value: FacilityEditInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const raw = body as Record<string, unknown>;

  const customerName = requiredTrimmed(raw.customerName, "Customer name", 120);
  if (!customerName.ok) return customerName;

  const email = optionalTrimmed(raw.email, "Email", 200);
  if (!email.ok) return email;
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    return { ok: false, error: "Email looks invalid." };
  }

  const phone = optionalTrimmed(raw.phone, "Phone", 40);
  if (!phone.ok) return phone;

  const parentName = optionalTrimmed(raw.parentName, "Parent name", 120);
  if (!parentName.ok) return parentName;

  const childName = optionalTrimmed(raw.childName, "Child name", 120);
  if (!childName.ok) return childName;

  const childAge = optionalTrimmed(raw.childAge, "Child age", 40);
  if (!childAge.ok) return childAge;

  const childGender = optionalTrimmed(raw.childGender, "Child gender", 40);
  if (!childGender.ok) return childGender;

  const partyTheme = optionalTrimmed(raw.partyTheme, "Party theme", 120);
  if (!partyTheme.ok) return partyTheme;

  const invitationDeliveryPreferences =
    normalizeInvitationDeliveryPreferences(raw.invitationDeliveryPreference);
  const invitationTemplateId = normalizeInvitationTemplateId(
    raw.invitationTemplateId,
  );

  const balloonColors = optionalTrimmed(
    raw.balloonColors,
    "Balloon colors",
    120,
  );
  if (!balloonColors.ok) return balloonColors;

  const tableClothColors = optionalTrimmed(
    raw.tableClothColors,
    "Table cloth colors",
    120,
  );
  if (!tableClothColors.ok) return tableClothColors;

  const drinkChoice = optionalTrimmed(raw.drinkChoice, "Drink choice", 80);
  if (!drinkChoice.ok) return drinkChoice;

  const notes = optionalTrimmed(raw.notes, "Notes", 2000);
  if (!notes.ok) return notes;

  const paymentMethod = requiredTrimmed(
    raw.paymentMethod,
    "Payment method",
    80,
  );
  if (!paymentMethod.ok) return paymentMethod;

  return {
    ok: true,
    value: {
      customerName: customerName.value,
      email: email.value,
      phone: phone.value,
      parentName: parentName.value,
      childName: childName.value,
      childAge: childAge.value,
      childGender: childGender.value,
      partyTheme: partyTheme.value,
      invitationDeliveryPreferences,
      invitationTemplateId,
      balloonColors: balloonColors.value,
      tableClothColors: tableClothColors.value,
      drinkChoice: drinkChoice.value,
      notes: notes.value,
      paymentMethod: paymentMethod.value,
    },
  };
}
