"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  fetchActiveWaiverTemplate,
  applyActiveTemplateToFormState,
  submitPublicWaiver,
} from "@/lib/waivers/public-client";
import {
  buildPublicSubmitBody,
  createInitialWaiverFormState,
  createParticipantDraft,
  createWaiverIdempotencyKey,
  validateParticipantsStep,
  validateSignerStep,
  todayYmdAmericaNewYork,
  type WaiverFormState,
  type FieldErrors,
} from "@/lib/waivers/public-form";
import {
  emptyTypedAgreement,
  validateTypedAgreements,
  ELECTRONIC_SIGNATURE_NOTICE,
  AGREEMENT_STATEMENTS,
  type TypedAgreement,
} from "@/lib/waivers/typed-agreements";
import { ageInCompletedYearsOnDate, isYmd } from "@/lib/open-play/pricing";
import { WAIVER_LIMITS } from "@/lib/waivers/validation";
import { validateWaiverPreferences } from "@/lib/waivers/preferences";
import {
  parseWaiverLanguage,
  WAIVER_LANGUAGES,
  waiverLanguageNames,
  type WaiverLanguage,
} from "@/lib/waivers/localization";
import { groupText, englishTermsHelp } from "@/lib/waivers/group-localization";
import type { BirthdayPartyOption } from "@/lib/open-play/check-in-client";

const fieldClass =
  "mt-2 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100";
const primary =
  "min-h-12 w-full rounded-xl bg-orange-600 px-5 py-3 font-black text-white hover:bg-orange-700 disabled:opacity-50";
const secondary =
  "min-h-12 w-full rounded-xl border-2 border-cyan-300 bg-white px-5 py-3 font-bold text-cyan-950 hover:bg-cyan-50 disabled:opacity-50";
function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  autoComplete = "off",
  maxLength = 80,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-bold text-slate-800">
      {label}
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => {
          if (type === "date") onChange(e.currentTarget.value);
        }}
        onBlur={(e) => {
          if (type === "date" && e.currentTarget.value !== value)
            onChange(e.currentTarget.value);
        }}
        className={fieldClass}
        autoComplete={autoComplete}
        aria-label={label}
        aria-invalid={Boolean(error)}
        max={type === "date" ? todayYmdAmericaNewYork() : undefined}
        maxLength={type === "text" ? maxLength : undefined}
      />
      {error && (
        <span className="mt-1 block text-sm text-red-700">{error}</span>
      )}
    </label>
  );
}
function AdultMode({
  value,
  onChange,
  language = "en",
}: {
  value: "playing" | "watching" | "decide_later" | null | undefined;
  onChange: (v: "playing" | "watching" | "decide_later") => void;
  language?: WaiverLanguage;
}) {
  const groupId = useId();
  return (
    <fieldset className="mt-4">
      <legend className="font-bold">
        Are you watching or playing?{" "}
        <span className="font-normal text-slate-600">Choose one.</span>
      </legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {(["watching", "playing", "decide_later"] as const).map((mode) => (
          <label
            key={mode}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${value === mode ? "border-orange-500 bg-orange-50" : "border-slate-300 bg-white"}`}
          >
            <input
              type="radio"
              name={groupId}
              required
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="h-5 w-5 accent-orange-600"
            />
            <span className="font-bold">
              {mode === "decide_later" ? "Decide later" : groupText(
                mode === "watching" ? "Watching — Free" : "Playing — $10",
                language,
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function WaiverFormClient() {
  const router = useRouter(),
    searchParams = useSearchParams();
  const [language, setLanguage] = useState<WaiverLanguage>(() =>
    parseWaiverLanguage(searchParams.get("lang")),
  );
  const [step, setStep] = useState<"information" | "agreement">("information");
  const [state, setState] = useState<WaiverFormState>(() => ({
    ...createInitialWaiverFormState(),
    signer: { ...createInitialWaiverFormState().signer, adultMode: null },
    participants: [createParticipantDraft({ tempId: "child-1" })],
  }));
  const [errors, setErrors] = useState<FieldErrors>({}),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [submitting, setSubmitting] = useState(false),
    [formError, setFormError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    lastAdded = useRef<string | null>(null),
    submitLock = useRef(false),
    requestKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [visitType, setVisitType] = useState<"open-play" | "party" | "decide_later" | "">("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [atFacility, setAtFacility] = useState(false);
  const [selectedPartyDate, setSelectedPartyDate] = useState(todayYmdAmericaNewYork);
  const [parties, setParties] = useState<BirthdayPartyOption[]>([]);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const linkedPartyId = searchParams.get("source") === "facility-party" ? searchParams.get("booking") : null;
  const partyBookingId = linkedPartyId || (selectedPartyId === "decide_later" ? "" : selectedPartyId);
  const facilityPartyDate = linkedPartyId ? searchParams.get("date") : selectedPartyDate;
  const isFacilityPartyWaiver =
    Boolean(partyBookingId);
  useEffect(() => {
    if (linkedPartyId || visitType !== "party" || !selectedPartyDate) return;
    const controller = new AbortController();
    void fetch(`/api/waiver/parties?date=${encodeURIComponent(selectedPartyDate)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Birthday parties could not load.");
        if (!controller.signal.aborted) setParties(payload.parties);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPartyError(error instanceof Error ? error.message : "Birthday parties could not load.");
      })
      .finally(() => { if (!controller.signal.aborted) setPartiesLoading(false); });
    return () => controller.abort();
  }, [linkedPartyId, visitType, selectedPartyDate]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchActiveWaiverTemplate({ signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (result.available)
          setState((prev) =>
            applyActiveTemplateToFormState(prev, result.template),
          );
        else setLoadError(result.message);
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, []);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (!lastAdded.current) return;
    const el = document.getElementById(lastAdded.current);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    el?.querySelector<HTMLInputElement>("input")?.focus({
      preventScroll: true,
    });
    lastAdded.current = null;
  }, [state.participants.length]);
  const adultRows = state.participants.filter((p) => p.kind === "adult"),
    children = state.participants.filter((p) => p.kind === "child");
  const preferences = {
    visitType: linkedPartyId ? "party" as const : visitType || "decide_later" as const,
    partyBookingId: linkedPartyId || (visitType === "party" ? selectedPartyId || null : null),
    partyDate: linkedPartyId ? searchParams.get("date") : visitType === "party" && selectedPartyId !== "decide_later" ? selectedPartyDate : null,
  };
  const draft = buildPublicSubmitBody({ ...state, preferences }, "information-preview"),
    adults = draft.participants.filter((p) => p.role !== "child");
  const setSigner = (key: keyof WaiverFormState["signer"], value: string) =>
    setState((prev) => ({
      ...prev,
      agreements: undefined,
      signer: { ...prev.signer, [key]: value },
    }));
  const updateParticipant = (id: string, key: string, value: string) =>
    setState((prev) => ({
      ...prev,
      agreements: undefined,
      participants: prev.participants.map((p) =>
        p.tempId === id ? { ...p, [key]: value } : p,
      ),
    }));
  const add = (kind: "adult" | "child") => {
    const p = createParticipantDraft({
      kind,
      adultMode: undefined,
    });
    lastAdded.current = p.tempId;
    setState((prev) => ({
      ...prev,
      agreements: undefined,
      participants: [...prev.participants, p],
    }));
  };
  const remove = (id: string) =>
    setState((prev) => ({
      ...prev,
      agreements: undefined,
      participants: prev.participants
        .filter((p) => p.tempId !== id)
        .map((p) =>
          p.guardianTempId === id ? { ...p, guardianTempId: null } : p,
        ),
    }));
  const informationErrors = (): FieldErrors => {
    const e = {
        ...validateSignerStep(state.signer),
        ...validateParticipantsStep(state.signer, state.participants),
      },
      today = todayYmdAmericaNewYork();
    if (!linkedPartyId && !visitType) e.visitType = "Choose Open Play, Birthday Party, or Decide later.";
    const preferenceError = validateWaiverPreferences(preferences);
    if (preferenceError) e.party = preferenceError;
    if (!linkedPartyId && visitType === "party" && selectedPartyId !== "decide_later" && (!parties.some((p) => p.id === selectedPartyId) || partiesLoading || partyError))
      e.party = "Choose the birthday party you are attending or Decide later.";
    for (const p of draft.participants) {
      if (p.role !== "child" && !p.adultMode)
        e[`adultMode.${p.tempId}`] = `Choose watching, playing, or Decide later for ${p.firstName || "each adult"}.`;
      if (!isYmd(p.dob) || p.dob > today) continue;
      const age = ageInCompletedYearsOnDate(p.dob, today);
      if (p.role === "child" && age >= 18)
        e[`age.${p.tempId}`] =
          `${p.firstName} is 18 or older. Enter them in the adult section.`;
      if (p.role !== "child" && age < 18)
        e[`age.${p.tempId}`] =
          `${p.firstName || "The signing adult"} must be at least 18.`;
    }
    return e;
  };
  const goToAgreement = () => {
    const e = informationErrors();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) {
      heading.current?.focus();
      return;
    }
    setState((prev) => ({
      ...prev,
      agreements:
        prev.agreements ?? adults.map((p) => emptyTypedAgreement(p.tempId)),
    }));
    setStep("agreement");
  };
  const changeAgreement = (id: string, changes: Partial<TypedAgreement>) =>
    setState((prev) => ({
      ...prev,
      agreements: (prev.agreements ?? []).map((a) =>
        a.participantTempId === id ? { ...a, ...changes } : a,
      ),
    }));
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    if (step === "information") {
      goToAgreement();
      return;
    }
    const info = informationErrors(),
      e = {
        ...info,
        ...validateTypedAgreements(
          draft.participants,
          state.agreements ?? [],
          todayYmdAmericaNewYork(),
        ),
      };
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) {
      if (Object.keys(info).length) setStep("information");
      heading.current?.focus();
      return;
    }
    if (!state.legalTemplateAvailable || !state.legalBodyHtml) {
      setFormError(loadError ?? "The current waiver must load before signing.");
      return;
    }
    const ready = {
        ...state,
        preferences,
        consent: {
          acknowledgedRisk: true,
          acknowledgedTerms: true,
          isLegalGuardian: true,
        },
      },
      fingerprint = JSON.stringify(buildPublicSubmitBody(ready, "preview"));
    if (requestKey.current?.fingerprint !== fingerprint)
      requestKey.current = { fingerprint, key: createWaiverIdempotencyKey() };
    submitLock.current = true;
    setSubmitting(true);
    const result = await submitPublicWaiver(
      buildPublicSubmitBody(ready, requestKey.current!.key),
    );
    if (!result.ok) {
      submitLock.current = false;
      setSubmitting(false);
      setFormError(result.message);
      if (result.code === "idempotency_conflict") requestKey.current = null;
      if (result.code === "template_inactive") {
        const fresh = await fetchActiveWaiverTemplate();
        if (fresh.available)
          setState((prev) => ({
            ...applyActiveTemplateToFormState(prev, fresh.template),
            agreements: adults.map((a) => emptyTypedAgreement(a.tempId)),
          }));
        setFormError(
          "The waiver terms changed. Please read the current terms and sign again.",
        );
      }
      return;
    }
    const completionParams = new URLSearchParams();
    if (isFacilityPartyWaiver) {
      completionParams.set("source", "facility-party");
      completionParams.set("booking", partyBookingId);
      if (facilityPartyDate) completionParams.set("date", facilityPartyDate);
      if (searchParams.get("arrival") === "1" || (!linkedPartyId && atFacility && facilityPartyDate === todayYmdAmericaNewYork()))
        completionParams.set("arrival", "1");
    }
    completionParams.set("lang", language);
    const query = completionParams.toString();
    router.replace(
      `/waiver/complete/${encodeURIComponent(result.publicToken)}${query ? `?${query}` : ""}`,
    );
  };
  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950 sm:py-12">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-5 shadow-xl sm:p-8">
        <div
          className="mb-5 flex flex-wrap gap-2"
          aria-label="Choose waiver language"
        >
          {WAIVER_LANGUAGES.map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => setLanguage(lang)}
              aria-pressed={language === lang}
              className={`min-h-11 rounded-xl border-2 px-3 font-bold ${language === lang ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}
            >
              {waiverLanguageNames[lang]}
            </button>
          ))}
        </div>
        <p className="text-sm font-black uppercase tracking-wider text-orange-800">
          Jumping Jax waiver · Step {step === "information" ? "1" : "2"} of 2
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-3 text-3xl font-black outline-none"
        >
          {step === "information"
            ? groupText("Your group’s information", language)
            : groupText("Read, agree and sign", language)}
        </h1>
        <p className="mt-3 leading-6 text-slate-600">
          {step === "information"
            ? "Start with the adult signing. Add other adults, then the children. Each adult signs for themselves; a parent or legal guardian signs for their own children."
            : "Each adult must read this waiver and personally type their first and last name in their own section."}
        </p>
        {isFacilityPartyWaiver && (
          <p className="mt-4 rounded-xl bg-orange-50 p-3 font-bold">
            Birthday party waiver
            {facilityPartyDate ? ` · ${facilityPartyDate}` : ""}
          </p>
        )}
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
          <p className="text-sm font-semibold text-slate-700">Complete every field and choose an answer for each preference. You can choose Decide later for preferences. Contact details, birth dates, guardian information and signing confirmations are required.</p>
          {(formError || Object.keys(errors).length > 0) && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-red-900"
            >
              <p className="font-bold">
                {formError ?? "Please correct the following:"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {Object.entries(errors).map(([key, value]) => (
                  <li key={key}>{value}</li>
                ))}
              </ul>
            </div>
          )}
          {step === "information" ? (
            <>
              {!linkedPartyId && (
                <section className="rounded-2xl border-2 border-cyan-200 p-4 sm:p-5">
                  <fieldset>
                    <legend className="text-xl font-black">What are you here for?</legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(["open-play", "party", "decide_later"] as const).map((value) => (
                        <label key={value} className="flex min-h-14 items-center gap-3 rounded-xl border-2 p-3 font-bold">
                          <input type="radio" name="visitType" checked={visitType === value}
                            onChange={() => { setVisitType(value); setSelectedPartyId(""); setPartiesLoading(value === "party"); setPartyError(null); setAtFacility(false); }} />
                          {value === "party" ? "Birthday party" : value === "decide_later" ? "Decide later" : "Open play"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {visitType === "party" && (
                    <div className="mt-4 space-y-4">
                      <label className="block font-bold">Party date
                        <input type="date" className={fieldClass} value={selectedPartyDate}
                          onChange={(e) => { setSelectedPartyDate(e.target.value); setSelectedPartyId(""); setParties([]); setPartiesLoading(true); setPartyError(null); setAtFacility(false); }} />
                      </label>
                      <button type="button" className={secondary}
                        onClick={() => { setSelectedPartyDate(""); setSelectedPartyId("decide_later"); setParties([]); setPartiesLoading(false); setPartyError(null); setAtFacility(false); }}>
                        Decide later — party date and selection
                      </button>
                      <label className="block font-bold">Whose birthday party are you attending?
                        <select className={fieldClass} value={selectedPartyId} required
                          onChange={(e) => setSelectedPartyId(e.target.value)}>
                          <option value="">Choose a birthday party</option>
                          <option value="decide_later">Decide later — choose my party at check-in</option>
                          {parties.map((party) => <option key={party.id} value={party.id}>{party.label}</option>)}
                        </select>
                      </label>
                      {selectedPartyId && selectedPartyId !== "decide_later" && selectedPartyDate === todayYmdAmericaNewYork() && (
                        <label className="flex min-h-12 items-center gap-3 font-bold">
                          <input type="checkbox" checked={atFacility} onChange={(e) => setAtFacility(e.target.checked)} />
                          We are at Jumping Jax now — check us into this party after signing.
                        </label>
                      )}
                      {partiesLoading && <p role="status">Loading birthday parties…</p>}
                      {partyError && <p role="alert">{partyError} Change the date to retry, or ask the front desk for the party link.</p>}
                      {!partiesLoading && !partyError && parties.length === 0 && <p>No birthday parties found for this date. Check the date or ask the front desk for the party link.</p>}
                    </div>
                  )}
                </section>
              )}
              <section className="rounded-2xl border-2 border-orange-200 bg-orange-50/40 p-4 sm:p-5">
                <h2 className="text-xl font-black">
                  Signing adult / parent or legal guardian
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label={groupText("Adult’s first name", language)}
                    value={state.signer.firstName}
                    onChange={(v) => setSigner("firstName", v)}
                    error={errors.firstName}
                    autoComplete="given-name"
                  />
                  <Field
                    label={groupText("Adult’s last name", language)}
                    value={state.signer.lastName}
                    onChange={(v) => setSigner("lastName", v)}
                    error={errors.lastName}
                    autoComplete="family-name"
                  />
                  <Field
                    label={groupText("Adult’s email address", language)}
                    type="email"
                    value={state.signer.email}
                    onChange={(v) => setSigner("email", v)}
                    error={errors.email}
                    autoComplete="email"
                  />
                  <Field
                    label={groupText("Adult’s phone number", language)}
                    type="tel"
                    value={state.signer.phone}
                    onChange={(v) => setSigner("phone", v)}
                    error={errors.phone}
                    autoComplete="tel"
                  />
                  <Field
                    label={groupText("Adult’s date of birth", language)}
                    type="date"
                    value={state.signer.dob}
                    onChange={(v) => setSigner("dob", v)}
                    error={errors.dob}
                    autoComplete="bday"
                  />
                  <Field label="Adult’s mailing address (street, city, state and ZIP)"
                    value={state.signer.address} onChange={(v) => setSigner("address", v)}
                    error={errors.address} autoComplete="street-address" maxLength={500} />
                </div>
                <AdultMode
                  language={language}
                  value={state.signer.adultMode}
                  onChange={(v) => setSigner("adultMode", v)}
                />
              </section>
              {adultRows.map((adult, index) => (
                <section
                  id={adult.tempId}
                  key={adult.tempId}
                  className="scroll-mt-6 rounded-2xl border-2 border-orange-200 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black">
                      Additional adult {index + 1}
                    </h2>
                    <button
                      type="button"
                      onClick={() => remove(adult.tempId)}
                      className="min-h-11 font-bold text-red-700"
                    >
                      Remove adult
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label={groupText("Adult’s first name", language)}
                      value={adult.firstName}
                      onChange={(v) =>
                        updateParticipant(adult.tempId, "firstName", v)
                      }
                    />
                    <Field
                      label={groupText("Adult’s last name", language)}
                      value={adult.lastName}
                      onChange={(v) =>
                        updateParticipant(adult.tempId, "lastName", v)
                      }
                    />
                    <Field
                      label={groupText("Adult’s date of birth", language)}
                      type="date"
                      value={adult.dob}
                      onChange={(v) =>
                        updateParticipant(adult.tempId, "dob", v)
                      }
                    />
                  </div>
                  <AdultMode
                    language={language}
                    value={adult.adultMode}
                    onChange={(v) =>
                      updateParticipant(adult.tempId, "adultMode", v)
                    }
                  />
                </section>
              ))}
              <button
                type="button"
                className={secondary}
                disabled={adults.length >= WAIVER_LIMITS.maxAdults}
                onClick={() => add("adult")}
              >
                {groupText("Add a playing adult", language)}
              </button>
              <div className="border-t-2 border-cyan-100 pt-6">
                <h2 className="text-2xl font-black">Children</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Select each child’s own parent or legal guardian from the
                  adults above. Children from another family need their own
                  guardian’s agreement.
                </p>
              </div>
              {children.map((child, index) => (
                <section
                  id={child.tempId}
                  key={child.tempId}
                  className="scroll-mt-6 rounded-2xl border-2 border-cyan-200 bg-cyan-50/40 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black">
                      Child {index + 1} information
                    </h3>
                    <button
                      type="button"
                      onClick={() => remove(child.tempId)}
                      className="min-h-11 font-bold text-red-700"
                    >
                      Remove child
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label={groupText("Child’s first name", language)}
                      value={child.firstName}
                      onChange={(v) =>
                        updateParticipant(child.tempId, "firstName", v)
                      }
                    />
                    <Field
                      label={groupText("Child’s last name", language)}
                      value={child.lastName}
                      onChange={(v) =>
                        updateParticipant(child.tempId, "lastName", v)
                      }
                    />
                    <Field
                      label={groupText("Child’s date of birth", language)}
                      type="date"
                      value={child.dob}
                      onChange={(v) =>
                        updateParticipant(child.tempId, "dob", v)
                      }
                    />
                    <label className="block text-sm font-bold">
                      Child’s parent or legal guardian
                      <select
                        className={fieldClass}
                        value={child.guardianTempId ?? ""}
                        onChange={(e) =>
                          updateParticipant(
                            child.tempId,
                            "guardianTempId",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Choose their guardian</option>
                        {adults.map((a) => (
                          <option value={a.tempId} key={a.tempId}>
                            {`${a.firstName} ${a.lastName}`.trim() ||
                              (a.tempId === "signer"
                                ? "Signing adult"
                                : "Additional adult")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              ))}
              <button
                type="button"
                className={secondary}
                disabled={children.length >= WAIVER_LIMITS.maxChildren}
                onClick={() => add("child")}
              >
                {groupText("Add another child", language)}
              </button>
              <button type="submit" className={primary}>
                {groupText("Agree and sign", language)}
              </button>
              <p className="text-center text-sm text-slate-600">
                Next: read the waiver and complete each adult’s agreement.
              </p>
            </>
          ) : (
            <>
              <p className="rounded-xl bg-cyan-50 p-4 text-sm leading-6">
                {englishTermsHelp[language]}
              </p>
              {loading ? (
                <p role="status">Loading the current waiver…</p>
              ) : state.legalBodyHtml ? (
                <article
                  className="waiver-legal space-y-4 rounded-2xl border-2 border-slate-200 p-4 text-base leading-7 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: state.legalBodyHtml }}
                />
              ) : (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-4 text-red-900"
                >
                  {loadError ??
                    "Waiver terms could not load. Please try again."}
                </p>
              )}
              {adults.map((adult) => {
                const a =
                    state.agreements?.find(
                      (a) => a.participantTempId === adult.tempId,
                    ) ?? emptyTypedAgreement(adult.tempId),
                  wards = children.filter(
                    (c) => c.guardianTempId === adult.tempId,
                  );
                return (
                  <section
                    key={adult.tempId}
                    className="rounded-2xl border-2 border-orange-200 bg-orange-50/40 p-4 sm:p-5"
                  >
                    <h2 className="text-xl font-black">
                      {adult.firstName} {adult.lastName} — agreement and
                      signature
                    </h2>
                    {wards.length > 0 && (
                      <p className="mt-2 font-semibold">
                        Signing for yourself and:{" "}
                        {wards
                          .map((c) => `${c.firstName} ${c.lastName}`)
                          .join(", ")}
                        .
                      </p>
                    )}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field
                        label={groupText(
                          "Type your first name to sign",
                          language,
                        )}
                        value={a.firstName}
                        onChange={(v) =>
                          changeAgreement(adult.tempId, { firstName: v })
                        }
                      />
                      <Field
                        label={groupText(
                          "Type your last name to sign",
                          language,
                        )}
                        value={a.lastName}
                        onChange={(v) =>
                          changeAgreement(adult.tempId, { lastName: v })
                        }
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6">
                      {ELECTRONIC_SIGNATURE_NOTICE} Your signed name must match
                      your name above.
                    </p>
                    <div className="mt-4 space-y-3">
                      {(
                        [
                          [
                            "acknowledgedRisk",
                            AGREEMENT_STATEMENTS.acknowledgedRisk,
                          ],
                          [
                            "acknowledgedTerms",
                            AGREEMENT_STATEMENTS.acknowledgedTerms,
                          ],
                          [
                            "electronicSignature",
                            AGREEMENT_STATEMENTS.electronicSignature,
                          ],
                          ...(wards.length
                            ? [
                                [
                                  "guardianAuthority",
                                  AGREEMENT_STATEMENTS.guardianAuthority,
                                ],
                              ]
                            : []),
                        ] as Array<[keyof TypedAgreement, string]>
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <input
                            type="checkbox"
                            required
                            className="mt-1 h-5 w-5 shrink-0 accent-orange-600"
                            checked={a[key] === true}
                            onChange={(e) =>
                              changeAgreement(adult.tempId, {
                                [key]: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm font-semibold leading-6">
                            {label}
                          </span>
                        </label>
                      ))}
                      <label className="block rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
                        Promotional photo permission — choose an answer
                        <select className={fieldClass} required value={a.photoConsentChoice ?? ""}
                          onChange={(e) => changeAgreement(adult.tempId, {
                            photoConsentChoice: e.target.value as "yes" | "no" | "decide_later",
                            photoConsent: e.target.value === "yes",
                          })}>
                          <option value="">Choose photo permission</option>
                          <option value="yes">Yes — I permit promotional photographs</option>
                          <option value="no">No — I do not permit promotional photographs</option>
                          <option value="decide_later">Decide later — no permission granted now</option>
                        </select>
                      </label>
                    </div>
                  </section>
                );
              })}
              <button
                type="button"
                className={secondary}
                disabled={submitting}
                onClick={() => {
                  setStep("information");
                  setErrors({});
                  setFormError(null);
                }}
              >
                {groupText("Back to group information", language)}
              </button>
              <button
                type="submit"
                className={primary}
                disabled={
                  submitting || loading || !state.legalTemplateAvailable
                }
              >
                {submitting
                  ? "Saving your waiver…"
                  : groupText("Complete waiver", language)}
              </button>
              <p className="text-center text-sm text-slate-600">
                A completed copy will be available to print or download.
                Admission is handled at check-in.
              </p>
            </>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="mr-4 font-bold underline"
          >
            Privacy policy
          </Link>
          Need help?{" "}
          <Link href="/contact" className="font-bold text-cyan-900 underline">
            Contact Jumping Jax
          </Link>
        </p>
      </section>
    </main>
  );
}
