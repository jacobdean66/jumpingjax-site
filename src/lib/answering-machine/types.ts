export type AnsweringMachineStatus =
  | "received"
  | "in_progress"
  | "processing"
  | "needs_review"
  | "approved"
  | "rejected"
  | "failed";

export type AnsweringMachineServiceKind = "rental" | "facility_party";

export type AnsweringMachineBookingDetails = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventStartTime: string;
  duration: string;
  requestedDeliveryWindow: string;
  eventAddress: string;
  distanceMiles: number | null;
  setupSurface: string;
  setupAccess: string;
  setupNotes: string;
  paymentMethod: string;
  facilityPartyKind: "public" | "private";
  facilityRoom: "room-10" | "room-20";
  facilityDurationMinutes: 90 | 120 | 180;
  childName: string;
  childGender: string;
  childAge: string;
  partyTheme: string;
  drinkChoice: string;
};

export type AnsweringMachineCall = {
  id: string;
  callReference: string;
  callerLabel: string;
  status: AnsweringMachineStatus;
  serviceKind: AnsweringMachineServiceKind | null;
  eventDate: string | null;
  facilityStartTime: string | null;
  rentalItems: string[];
  transcript: string;
  transcriptComplete: boolean;
  voicemailAvailable: boolean;
  agentSummary: string;
  ownerNotes: string;
  bookingDetails: AnsweringMachineBookingDetails;
  bookingKind: AnsweringMachineServiceKind | null;
  bookingId: string | null;
  bookingCreatedAt: string | null;
  bookingError: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type AnsweringMachineReviewInput = {
  id: string;
  action: "save" | "book" | "reject";
  expectedRevision: number;
  patch: {
    serviceKind: AnsweringMachineServiceKind | null;
    eventDate: string | null;
    facilityStartTime: string | null;
    rentalItems: string[];
    transcript: string;
    transcriptComplete: boolean;
    agentSummary: string;
    ownerNotes: string;
    bookingDetails: AnsweringMachineBookingDetails;
  };
};
