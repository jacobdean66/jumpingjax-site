"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdultCheckInControls } from "@/components/open-play/AdultCheckInControls";
import {
  buildLegacyCheckInBody,
  buildVisitCreateBody,
  canSubmitCheckInGroup,
  createLegacyCheckInRequest,
  createOpenPlayVisitRequest,
  isAdultRole,
  type AdultPlayMode,
  type PaymentMethodChoice,
  resultToDraft,
  type SelectedAttendeeDraft,
} from "@/lib/open-play/check-in-client";
import {
  attendeeStatusLabel,
  classificationLabel,
  formatCents,
  sortVisitsForDisplay,
  type DailyReport,
} from "@/lib/open-play/daily-report-client";
import type { StaffWaiverParticipant } from "@/lib/waivers/search";

type Props = {
  report: DailyReport;
};

type Attendee = DailyReport["visits"][number]["attendees"][number];

type SelectedCard = {
  attendee: Attendee;
  visitId: string;
  checkedInAt: string;
  visitSource?: "native" | "legacy_smartwaiver";
  visitNotes: string | null;
  payments: DailyReport["visits"][number]["payments"];
};

type ProfileOverride = {
  firstName: string;
  lastName: string;
  birthDate: string;
};

type PaymentOption = "cash" | "card" | "free_pass";

type AdmissionOverride = {
  amountCents: number;
  paymentOption: PaymentOption;
  classification: Attendee["classification"];
};

function formatBirthday(value: string | undefined): string {
  if (!value) return "Not recorded";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function ageOnDate(birthDate: string | undefined, dateYmd: string): number | null {
  if (!birthDate) return null;
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = dateYmd.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay || !year || !month || !day) return null;
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age >= 0 ? age : null;
}

function checkInTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function signedAtLabel(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: value.length === 10 ? undefined : "short",
  }).format(date);
}

function participantRole(role: "child" | "adult_signer" | "adult_covered"): string {
  if (role === "adult_signer") return "Signer";
  if (role === "adult_covered") return "Covered adult";
  return "Child";
}

function birthdayPartyFromNotes(notes: string | null, fullName: string): string | null {
  if (!notes) return null;
  const prefix = `${fullName} attending `;
  const match = notes.split("; ").find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() || null : null;
}

export function DailyReportActivity({ report }: Props) {
  const router = useRouter();
  const visits = sortVisitsForDisplay(report);
  const checkedIn = visits.flatMap((visit) =>
    visit.status === "voided"
      ? []
      : visit.attendees
          .filter((attendee) => attendee.status === "active")
          .map((attendee) => ({
            attendee,
            visitId: visit.visitId,
            checkedInAt: visit.createdAt,
            visitSource: visit.source,
            visitNotes: visit.notes,
            payments: visit.payments,
          })),
  );
  const [selected, setSelected] = useState<SelectedCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileOverride>({
    firstName: "",
    lastName: "",
    birthDate: "",
  });
  const [overrides, setOverrides] = useState<Record<string, ProfileOverride>>({});
  const [admissionOverrides, setAdmissionOverrides] = useState<Record<string, AdmissionOverride>>({});
  const [draftAmount, setDraftAmount] = useState("");
  const [draftPaymentOption, setDraftPaymentOption] = useState<PaymentOption>("cash");
  const [draftAdultMode, setDraftAdultMode] = useState<"playing" | "watching" | null>(null);
  const [relatedAdultDraft, setRelatedAdultDraft] = useState<SelectedAttendeeDraft | null>(null);
  const [addingRelatedAdult, setAddingRelatedAdult] = useState(false);
  const [relatedAdultError, setRelatedAdultError] = useState<string | null>(null);

  function admissionFor(item: SelectedCard): AdmissionOverride {
    const saved = admissionOverrides[item.attendee.id];
    if (saved) return saved;
    const entries = item.payments.filter((entry) => entry.attendeeId === item.attendee.id);
    const amountCents = Math.max(0, entries.reduce((total, entry) => total + entry.amountCents, 0));
    let paymentOption: PaymentOption = "cash";
    for (const entry of entries) {
      if (entry.entryType === "charge" || (entry.entryType === "correction" && entry.amountCents > 0)) {
        paymentOption = entry.method;
      }
    }
    return {
      amountCents,
      paymentOption: amountCents === 0 ? "free_pass" : paymentOption,
      classification: item.attendee.classification,
    };
  }

  function profileFor(attendee: Attendee): ProfileOverride {
    return (
      overrides[attendee.id] ?? {
        firstName: attendee.firstName ?? "",
        lastName: attendee.lastName ?? "",
        birthDate: attendee.birthDate ?? "",
      }
    );
  }

  function isAdultOnWaiver(role: StaffWaiverParticipant["role"]): boolean {
    return isAdultRole(role);
  }

  function waiverParticipantRecordId(participant: StaffWaiverParticipant): string | null {
    return participant.source === "legacy_smartwaiver"
      ? participant.legacyParticipantId ?? null
      : participant.participantId ?? null;
  }

  function isAlreadyOnLocation(participant: StaffWaiverParticipant): boolean {
    const key = waiverParticipantRecordId(participant);
    if (!key) return false;
    return checkedIn.some(
      (item) =>
        (item.attendee.participantRecordId === key &&
          (item.attendee.source ?? "native") === (participant.source ?? "native")),
    );
  }

  function startRelatedAdult(participant: StaffWaiverParticipant) {
    try {
      const draft = resultToDraft(participant);
      setRelatedAdultDraft(draft);
      setRelatedAdultError(null);
    } catch (error) {
      setRelatedAdultError(error instanceof Error ? error.message : "Unable to add this participant right now.");
    }
  }

  function setRelatedAdultMode(selectionKey: string, mode: AdultPlayMode) {
    setRelatedAdultDraft((current) =>
      current && current.selectionKey === selectionKey
        ? {
            ...current,
            adultMode: mode,
            priceOverrideCents: mode === "playing" ? 700 : null,
            paymentMethod: null,
            paymentConfirmed: false,
            birthdayPartyId: null,
            birthdayPartyLabel: null,
          }
        : current,
    );
  }

  function setRelatedAdultPaymentMethod(
    selectionKey: string,
    method: PaymentMethodChoice,
  ) {
    setRelatedAdultDraft((current) =>
      current && current.selectionKey === selectionKey
        ? {
            ...current,
            paymentMethod: method,
            paymentConfirmed: false,
            birthdayPartyId: null,
            birthdayPartyLabel: null,
          }
        : current,
    );
  }

  function setRelatedAdultPaymentConfirmed(selectionKey: string, confirmed: boolean) {
    setRelatedAdultDraft((current) =>
      current && current.selectionKey === selectionKey
        ? { ...current, paymentConfirmed: confirmed }
        : current,
    );
  }

  async function addRelatedAdult() {
    if (!relatedAdultDraft) return;
    const gate = canSubmitCheckInGroup([relatedAdultDraft], report.businessDayYmd);
    if (!gate.ok) {
      setRelatedAdultError(gate.message);
      return;
    }

  const isLegacy = relatedAdultDraft.source === "legacy_smartwaiver";

    setAddingRelatedAdult(true);
    setRelatedAdultError(null);
    setSavedMessage(null);

    try {
      if (isLegacy) {
        const legacyBody = buildLegacyCheckInBody({
          visitDateYmd: report.businessDayYmd,
          attendees: [relatedAdultDraft],
        });
        await createLegacyCheckInRequest(legacyBody);
      } else {
        const visitBody = buildVisitCreateBody({
          visitDateYmd: report.businessDayYmd,
          attendees: [relatedAdultDraft],
        });
        await createOpenPlayVisitRequest(visitBody);
      }
      setSavedMessage(`${relatedAdultDraft.fullName} added as on location.`);
      setRelatedAdultDraft(null);
      router.refresh();
    } catch (error) {
      setRelatedAdultError(error instanceof Error ? error.message : "The participant could not be added.");
    } finally {
      setAddingRelatedAdult(false);
    }
  }

  function openCard(item: SelectedCard) {
    const admission = admissionFor(item);
    setSelected(item);
    setDraft(profileFor(item.attendee));
    setDraftAmount((admission.amountCents / 100).toFixed(2));
    setDraftPaymentOption(admission.paymentOption);
    setDraftAdultMode(
      admission.classification === "playing_adult"
        ? "playing"
        : admission.classification === "watching_adult"
          ? "watching"
          : null,
    );
    setEditing(false);
    setSaveError(null);
    setSavedMessage(null);
    setRelatedAdultDraft(null);
    setRelatedAdultError(null);
  }

  function closeCard() {
    if (saving || addingRelatedAdult) return;
    setSelected(null);
    setEditing(false);
    setSaveError(null);
    setSavedMessage(null);
    setRelatedAdultDraft(null);
    setRelatedAdultError(null);
  }

  async function saveProfile() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    try {
      const adult =
        selected.attendee.classification === "playing_adult" ||
        selected.attendee.classification === "watching_adult";
      const paymentOption: PaymentOption = adult && draftAdultMode === "watching"
        ? "free_pass"
        : draftPaymentOption;
      const amountCents = adult
        ? draftAdultMode === "playing" ? 700 : 0
        : paymentOption === "free_pass"
          ? 0
          : Math.round(Number(draftAmount) * 100);
      if (!Number.isInteger(amountCents) || amountCents < 0 || amountCents > 50_000) {
        throw new Error("Enter a valid admission amount between $0 and $500.");
      }
      const source = selected.attendee.source ?? selected.visitSource;
      if (source === "legacy_smartwaiver" && selected.attendee.participantRecordId) {
        const response = await fetch("/api/admin/open-play/attendee-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: selected.attendee.participantRecordId,
            source,
            firstName: draft.firstName,
            lastName: draft.lastName,
            birthDate: draft.birthDate,
          }),
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; profile?: ProfileOverride }
          | null;
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "The child details could not be saved.");
        }
      }
      const admissionResponse = await fetch("/api/admin/open-play/attendee-admission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeId: selected.attendee.id,
          visitId: selected.visitId,
          source,
          amountCents,
          paymentOption,
          adultMode: adult ? draftAdultMode : null,
        }),
      });
      const admissionResult = (await admissionResponse.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!admissionResponse.ok || !admissionResult?.ok) {
        throw new Error(admissionResult?.error || "The admission details could not be saved.");
      }
      setOverrides((current) => ({ ...current, [selected.attendee.id]: draft }));
      setAdmissionOverrides((current) => ({
        ...current,
        [selected.attendee.id]: {
          amountCents,
          paymentOption,
          classification: adult
            ? draftAdultMode === "playing" ? "playing_adult" : "watching_adult"
            : selected.attendee.classification,
        },
      }));
      setEditing(false);
      setSavedMessage("Check-in details saved.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The child details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (checkedIn.length === 0) {
    return (
      <section
        id="todays-check-ins"
        aria-labelledby="daily-report-activity-heading"
        className="scroll-mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4"
      >
        <h2 id="daily-report-activity-heading" className="text-xl font-black text-slate-950">
          Today&apos;s check-ins
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          No guests are checked in for this date.
        </p>
      </section>
    );
  }

  const selectedProfile = selected ? profileFor(selected.attendee) : null;
  const selectedName = selectedProfile
    ? `${selectedProfile.firstName} ${selectedProfile.lastName}`.trim()
    : "";
  const selectedAdmission = selected ? admissionFor(selected) : null;
  const selectedBirthdayParty = selected
    ? birthdayPartyFromNotes(selected.visitNotes, selectedName)
    : null;
  const canEditProfile =
    (selected?.attendee.source ?? selected?.visitSource) === "legacy_smartwaiver";
  const canEdit = selected?.attendee.status === "active";
  const selectedIsAdult =
    selectedAdmission?.classification === "playing_adult" ||
    selectedAdmission?.classification === "watching_adult";
  const relatedAdultCanSubmit = relatedAdultDraft
    ? canSubmitCheckInGroup([relatedAdultDraft], report.businessDayYmd)
    : null;

  return (
    <section
      id="todays-check-ins"
      aria-labelledby="daily-report-activity-heading"
      className="scroll-mt-4 space-y-3"
    >
      <h2 id="daily-report-activity-heading" className="text-xl font-black text-slate-950">
        Today&apos;s check-ins
      </h2>
      <p className="text-sm font-semibold text-slate-600">
        {checkedIn.length} participant{checkedIn.length === 1 ? "" : "s"} · tap a name for details.
      </p>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {checkedIn.map((item) => {
          const profile = profileFor(item.attendee);
          const name = `${profile.firstName} ${profile.lastName}`.trim() || "Guest";
          const age = ageOnDate(profile.birthDate, report.businessDayYmd);
          return (
            <li key={item.attendee.id}>
              <button
                type="button"
                onClick={() => openCard(item)}
                className="group w-full rounded-xl border border-emerald-300 bg-gradient-to-br from-white via-emerald-50 to-cyan-100 px-3 py-2 text-left shadow-[0_4px_0_#059669,0_7px_12px_rgba(15,23,42,0.14)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_0_#059669,0_9px_14px_rgba(15,23,42,0.16)] active:translate-y-0.5 active:shadow-[0_2px_0_#059669]"
                aria-label={`Open child card for ${name}`}
              >
                <span className="block truncate text-sm font-black text-slate-950">{name}</span>
                <span className="block text-xs font-bold text-emerald-900">
                  Age {age ?? item.attendee.ageYearsOnVisit ?? "Not recorded"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && selectedProfile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="child-card-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCard();
          }}
        >
          <article className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  Check-in details
                </p>
                <h3 id="child-card-title" className="mt-2 text-2xl font-black text-slate-950">
                  {selectedName || "Guest"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCard}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-lg font-black text-slate-700"
                aria-label="Close child card"
              >
                ×
              </button>
            </div>

            {editing ? (
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-black text-slate-700">
                  First name
                  <input
                    value={draft.firstName}
                    disabled={!canEditProfile}
                    onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white/90 px-4 text-base outline-none focus:border-emerald-500"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="text-sm font-black text-slate-700">
                  Last name
                  <input
                    value={draft.lastName}
                    disabled={!canEditProfile}
                    onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white/90 px-4 text-base outline-none focus:border-emerald-500"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="text-sm font-black text-slate-700">
                  Birthday
                  <input
                    type="date"
                    value={draft.birthDate}
                    disabled={!canEditProfile}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setDraft((current) => ({ ...current, birthDate: event.target.value }))}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white/90 px-4 text-base outline-none focus:border-emerald-500"
                    required
                  />
                </label>
                {selectedIsAdult ? (
                  <>
                    <fieldset>
                      <legend className="text-sm font-black text-slate-700">Adult attendance</legend>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(["watching", "playing"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={draftAdultMode === mode}
                            onClick={() => {
                              setDraftAdultMode(mode);
                              setDraftAmount(mode === "playing" ? "7.00" : "0.00");
                              if (mode === "watching") setDraftPaymentOption("free_pass");
                              else if (draftPaymentOption === "free_pass") setDraftPaymentOption("cash");
                            }}
                            className={draftAdultMode === mode ? "min-h-12 rounded-xl border-2 border-sky-600 bg-sky-50 px-3 text-sm font-black capitalize text-sky-950" : "min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black capitalize text-slate-800"}
                          >
                            {mode === "watching" ? "Watching — free" : "Playing — $7"}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {draftAdultMode === "playing" ? (
                      <label className="text-sm font-black text-slate-700">
                        How did they pay?
                        <select value={draftPaymentOption === "card" ? "card" : "cash"} onChange={(event) => setDraftPaymentOption(event.target.value as PaymentOption)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white/90 px-4 text-base outline-none focus:border-emerald-500">
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                        </select>
                      </label>
                    ) : (
                      <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">Watching adults are free.</p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="text-sm font-black text-slate-700">
                      Payment option
                      <select
                        value={draftPaymentOption}
                        onChange={(event) => {
                          const option = event.target.value as PaymentOption;
                          setDraftPaymentOption(option);
                          if (option === "free_pass") setDraftAmount("0.00");
                        }}
                        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white/90 px-4 text-base outline-none focus:border-emerald-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="free_pass">Free pass</option>
                      </select>
                    </label>
                    <label className="text-sm font-black text-slate-700">
                      Admission amount
                      <span className="mt-2 flex min-h-12 items-center rounded-xl border border-slate-300 bg-white/90 px-4 focus-within:border-emerald-500">
                        <span className="font-black text-slate-600">$</span>
                        <input type="number" inputMode="decimal" min="0" max="500" step="0.01" value={draftAmount} disabled={draftPaymentOption === "free_pass"} onChange={(event) => setDraftAmount(event.target.value)} className="min-h-10 w-full bg-transparent px-2 text-base outline-none disabled:text-slate-500" required />
                      </span>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <dl className="mt-5 grid gap-3 rounded-2xl border border-white/80 bg-white/55 p-4">
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Birthday</dt>
                  <dd className="mt-1 font-black text-slate-950">{formatBirthday(selectedProfile.birthDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Age on this date</dt>
                  <dd className="mt-1 font-black text-slate-950">
                    {ageOnDate(selectedProfile.birthDate, report.businessDayYmd) ??
                      selected.attendee.ageYearsOnVisit ??
                      "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Check-in time</dt>
                  <dd className="mt-1 font-black text-slate-950">{checkInTime(selected.checkedInAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Admission</dt>
                  <dd className="mt-1 font-black text-slate-950">
                    {classificationLabel(selectedAdmission?.classification ?? selected.attendee.classification)} · {formatCents(selectedAdmission?.amountCents ?? selected.attendee.unitPriceCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Payment option</dt>
                  <dd className="mt-1 font-black capitalize text-slate-950">
                    {selectedAdmission?.classification === "watching_adult"
                      ? "No payment — watching adult"
                      : selectedBirthdayParty
                      ? `Birthday party — ${selectedBirthdayParty}`
                      : (selectedAdmission?.paymentOption ?? "cash").replace("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="mt-1 font-black text-slate-950">{attendeeStatusLabel(selected.attendee.status)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver source</dt>
                  <dd className="mt-1 font-black text-slate-950">
                    {(selected.attendee.source ?? selected.visitSource) === "legacy_smartwaiver"
                      ? "Legacy Smartwaiver"
                      : "Native waiver"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver signer</dt>
                  <dd className="mt-1 font-black text-slate-950">{selected.attendee.waiverDetails?.signerFullName || "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Phone number</dt>
                  <dd className="mt-1 font-black text-slate-950">
                    {selected.attendee.waiverDetails?.signerPhone
                      ? <a className="underline decoration-2 underline-offset-2" href={`tel:${selected.attendee.waiverDetails.signerPhone}`}>{selected.attendee.waiverDetails.signerPhone}</a>
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Email</dt>
                  <dd className="mt-1 break-all font-black text-slate-950">
                    {selected.attendee.waiverDetails?.signerEmail
                      ? <a className="underline decoration-2 underline-offset-2" href={`mailto:${selected.attendee.waiverDetails.signerEmail}`}>{selected.attendee.waiverDetails.signerEmail}</a>
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver signed</dt>
                  <dd className="mt-1 font-black text-slate-950">{signedAtLabel(selected.attendee.waiverDetails?.signedAt ?? "")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver expires</dt>
                  <dd className="mt-1 font-black text-slate-950">{formatBirthday(selected.attendee.waiverDetails?.expiresOnYmd)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver status</dt>
                  <dd className="mt-1 font-black capitalize text-slate-950">{selected.attendee.waiverDetails?.status || "Not recorded"}</dd>
                </div>
                {selected.attendee.waiverDetails?.signerDobYmd ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Signer birthday</dt>
                    <dd className="mt-1 font-black text-slate-950">{formatBirthday(selected.attendee.waiverDetails.signerDobYmd)}</dd>
                  </div>
                ) : null}
                {selected.attendee.waiverDetails?.waiverId ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver ID</dt>
                    <dd className="mt-1 break-all font-black text-slate-950">{selected.attendee.waiverDetails.waiverId}</dd>
                  </div>
                ) : null}
                {selected.attendee.waiverDetails?.waiverTitle ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Waiver title</dt>
                    <dd className="mt-1 font-black text-slate-950">{selected.attendee.waiverDetails.waiverTitle}</dd>
                  </div>
                ) : null}
                {selected.attendee.waiverDetails?.tags?.length ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Tags</dt>
                    <dd className="mt-1 font-black text-slate-950">{selected.attendee.waiverDetails.tags.join(", ")}</dd>
                  </div>
                ) : null}
                {selected.attendee.waiverDetails?.priorCheckIns?.length ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Imported check-ins</dt>
                    <dd className="mt-1 font-black text-slate-950">{selected.attendee.waiverDetails.priorCheckIns.join(", ")}</dd>
                  </div>
                ) : null}
                {typeof selected.attendee.waiverDetails?.marketingConsent === "boolean" ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Marketing consent</dt>
                    <dd className="mt-1 font-black text-slate-950">{selected.attendee.waiverDetails.marketingConsent ? "Yes" : "No"}</dd>
                  </div>
                ) : null}
              </dl>
            )}

            {!editing && selected.attendee.waiverParticipants?.length ? (
              <section className="mt-4 rounded-2xl border border-white/80 bg-white/55 p-4" aria-label="Everyone on this waiver">
                <h4 className="font-black text-slate-950">Everyone on this waiver</h4>
                <ul className="mt-3 grid gap-2">
                  {selected.attendee.waiverParticipants.map((participant) => {
                    const isAdult = isAdultOnWaiver(participant.role);
                    const alreadyChecked = isAlreadyOnLocation(participant);
                    const isSelected = relatedAdultDraft?.selectionKey === participant.selectionKey;
                    return (
                      <li key={participant.selectionKey} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black text-slate-950">{participant.fullName}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[0.65rem] font-black uppercase text-slate-700">{participantRole(participant.role)}</span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-600">Birthday {formatBirthday(participant.dobYmd)}</p>
                        {isAdult ? (
                          alreadyChecked ? (
                            <p className="mt-3 rounded-lg bg-emerald-100 p-3 text-sm font-black text-emerald-900">Already on location</p>
                          ) : isSelected ? (
                            <div className="mt-3">
                              {relatedAdultDraft ? (
                                <AdultCheckInControls
                                  attendee={relatedAdultDraft}
                                  onAdultModeChange={setRelatedAdultMode}
                                  onPaymentMethodChange={setRelatedAdultPaymentMethod}
                                  onPaymentConfirmedChange={setRelatedAdultPaymentConfirmed}
                                />
                              ) : null}
                              {relatedAdultError ? (
                                <p className="mt-3 text-sm font-bold text-rose-700" role="alert">{relatedAdultError}</p>
                              ) : null}
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  disabled={addingRelatedAdult}
                                  onClick={() => {
                                    setRelatedAdultDraft(null);
                                    setRelatedAdultError(null);
                                  }}
                                  className="min-h-11 rounded-xl border border-slate-300 bg-white/80 px-4 text-sm font-black text-slate-700 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!relatedAdultCanSubmit?.ok || addingRelatedAdult}
                                  onClick={() => {
                                    void addRelatedAdult();
                                  }}
                                  className="min-h-11 rounded-xl bg-sky-600 px-4 text-sm font-black text-white shadow-[0_5px_0_#0369a1] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                                >
                                  {addingRelatedAdult ? "Saving…" : "Check in adult"}
                                </button>
                              </div>
                            </div>
                          ) : !participant.checkInEligible ? (
                            <p className="mt-3 rounded-lg bg-rose-100 p-3 text-sm font-black text-rose-900">Not eligible for check-in</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startRelatedAdult(participant)}
                              className="mt-3 min-h-11 w-full rounded-full border-2 border-emerald-500 bg-white px-5 text-sm font-black text-emerald-900"
                            >
                              {participantRole(participant.role) === "Signer" ? "Check in signer" : "Check in adult"}
                            </button>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {saveError ? <p className="mt-4 text-sm font-bold text-rose-700" role="alert">{saveError}</p> : null}
            {savedMessage ? <p className="mt-4 text-sm font-bold text-emerald-700" role="status">{savedMessage}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              {editing ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const admission = admissionFor(selected);
                      setDraft(profileFor(selected.attendee));
                      setDraftAmount((admission.amountCents / 100).toFixed(2));
                      setDraftPaymentOption(admission.paymentOption);
                      setDraftAdultMode(
                        admission.classification === "playing_adult" ? "playing" :
                          admission.classification === "watching_adult" ? "watching" : null,
                      );
                      setEditing(false);
                      setSaveError(null);
                    }}
                    className="min-h-12 rounded-xl border border-slate-300 bg-white/80 px-4 text-sm font-black text-slate-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      (canEditProfile &&
                        (!draft.firstName.trim() ||
                          !draft.lastName.trim() ||
                          !draft.birthDate)) ||
                      (selectedIsAdult
                        ? !draftAdultMode ||
                          (draftAdultMode === "playing" &&
                            draftPaymentOption !== "cash" &&
                            draftPaymentOption !== "card")
                        : draftPaymentOption !== "free_pass" && !draftAmount)
                    }
                    onClick={() => void saveProfile()}
                    className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-[0_5px_0_#047857] active:translate-y-1 active:shadow-none disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save details"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeCard}
                    className="min-h-12 rounded-xl border border-slate-300 bg-white/80 px-4 text-sm font-black text-slate-700"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      const admission = admissionFor(selected);
                      setDraft(profileFor(selected.attendee));
                      setDraftAmount((admission.amountCents / 100).toFixed(2));
                      setDraftPaymentOption(admission.paymentOption);
                      setDraftAdultMode(
                        admission.classification === "playing_adult" ? "playing" :
                          admission.classification === "watching_adult" ? "watching" : null,
                      );
                      setEditing(true);
                      setSaveError(null);
                      setSavedMessage(null);
                    }}
                    className="min-h-12 rounded-xl bg-sky-600 px-4 text-sm font-black text-white shadow-[0_5px_0_#0369a1] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    {canEdit ? "Edit details" : "Signed record"}
                  </button>
                </>
              )}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
