export type AnsweringMachineStatus =
  | "received"
  | "in_progress"
  | "processing"
  | "needs_review"
  | "approved"
  | "rejected"
  | "failed";

export type AnsweringMachineServiceKind = "rental" | "facility_party";

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
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type AnsweringMachineReviewInput = {
  id: string;
  action: "save" | "approve" | "reject";
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
  };
};
