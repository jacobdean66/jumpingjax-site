"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { ParticipantCard } from "@/components/waiver/ParticipantCard";
import { SignaturePad } from "@/components/waiver/SignaturePad";
import { WaiverStepProgress } from "@/components/waiver/StepProgress";
import {
  applyActiveTemplateToFormState,
  clearActiveTemplateFromFormState,
  fetchActiveWaiverTemplate,
  submitPublicWaiver,
} from "@/lib/waivers/public-client";
import { messageForPublicWaiverError } from "@/lib/waivers/public-errors";
import {
  localizeWaiverError,
  localizedWaiverLegalHtml,
  parseWaiverLanguage,
  waiverCopy,
  waiverLanguageNames,
  WAIVER_LANGUAGES,
  type WaiverLanguage,
} from "@/lib/waivers/localization";
import {
  buildPublicSubmitBody,
  createInitialWaiverFormState,
  createParticipantDraft,
  createWaiverIdempotencyKey,
  type FieldErrors,
  type WaiverFormState,
  type WaiverFormStep,
  validateLegalStep,
  validateParticipantsStep,
  validateSignatureStep,
  validateSignerStep,
  waiverDraftFingerprint,
} from "@/lib/waivers/public-form";

const fieldClass =
  "mt-1.5 w-full min-h-12 rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-200";

const primaryBtnClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-600 px-6 text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const secondaryBtnClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-cyan-200 bg-cyan-50 px-6 text-base font-bold text-cyan-950 transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 sm:w-auto";

function ErrorSummary({
  errors,
  titleId,
  language,
}: {
  errors: FieldErrors;
  titleId: string;
  language: WaiverLanguage;
}) {
  const t = waiverCopy(language);
  const messages = Object.values(errors);
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-red-900"
    >
      <p id={titleId} className="font-black">
        {t.fix}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold">
        {messages.map((message) => (
          <li key={message}>{localizeWaiverError(message, language)}</li>
        ))}
      </ul>
    </div>
  );
}

export function WaiverFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<WaiverLanguage>(() =>
    parseWaiverLanguage(searchParams.get("lang")),
  );
  const [step, setStep] = useState<WaiverFormStep>("signer");
  const [state, setState] = useState<WaiverFormState>(() =>
    createInitialWaiverFormState(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const idempotencyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const errorTitleId = useId();
  const t = waiverCopy(language);
  const translatedLegalHtml = localizedWaiverLegalHtml(language, state.templateVersionId);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadTemplate() {
      setTemplateLoading(true);
      setTemplateLoadError(null);
      // Clear any prior template fields before fetch so stale content cannot submit.
      setState((prev) => clearActiveTemplateFromFormState(prev));

      const result = await fetchActiveWaiverTemplate({ signal: controller.signal });
      if (cancelled) return;

      if (!result.available) {
        setState((prev) => clearActiveTemplateFromFormState(prev));
        setTemplateLoadError(result.message);
        setTemplateLoading(false);
        return;
      }

      setState((prev) => applyActiveTemplateToFormState(prev, result.template));
      setTemplateLoadError(null);
      setTemplateLoading(false);
    }

    void loadTemplate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const goNext = () => {
    setFormError(null);
    if (step === "signer") {
      const nextErrors = validateSignerStep(state.signer);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      setStep("participants");
      return;
    }
    if (step === "participants") {
      const nextErrors = validateParticipantsStep(state.signer, state.participants);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      setStep("legal");
      return;
    }
    if (step === "legal") {
      // Includes template availability + consent — fail closed without server version.
      const nextErrors = validateLegalStep(state);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      setStep("signature");
      return;
    }
    if (step === "signature") {
      const nextErrors = validateSignatureStep(state);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      setStep("review");
    }
  };

  const goBack = () => {
    setFormError(null);
    setErrors({});
    if (step === "participants") setStep("signer");
    else if (step === "legal") setStep("participants");
    else if (step === "signature") setStep("legal");
    else if (step === "review") setStep("signature");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const legalErrors = validateLegalStep(state);
    const signatureErrors = validateSignatureStep(state);
    const signerErrors = validateSignerStep(state.signer);
    const participantErrors = validateParticipantsStep(
      state.signer,
      state.participants,
    );
    const combined = {
      ...signerErrors,
      ...participantErrors,
      ...legalErrors,
      ...signatureErrors,
    };
    setErrors(combined);
    if (Object.keys(combined).length > 0) {
      if (Object.keys(legalErrors).length) setStep("legal");
      else if (Object.keys(signatureErrors).length) setStep("signature");
      else if (Object.keys(participantErrors).length) setStep("participants");
      else setStep("signer");
      setFormError(messageForPublicWaiverError("client_validation"));
      return;
    }

    if (
      templateLoading ||
      templateLoadError ||
      !state.legalTemplateAvailable ||
      !state.legalBodyHtml ||
      !state.templateVersionId.trim()
    ) {
      setFormError(
        templateLoadError ?? messageForPublicWaiverError("missing_template"),
      );
      setStep("legal");
      return;
    }

    const draftWithoutKey = buildPublicSubmitBody(state, "pending-idempotency-key");
    const { idempotencyKey: _ignored, ...fingerprintSource } = draftWithoutKey;
    void _ignored;
    const fingerprint = waiverDraftFingerprint(fingerprintSource);

    let idempotencyKey = idempotencyRef.current?.key;
    if (!idempotencyKey || idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyKey = createWaiverIdempotencyKey();
      idempotencyRef.current = { key: idempotencyKey, fingerprint };
    }

    const body = buildPublicSubmitBody(state, idempotencyKey);
    setSubmitting(true);
    setFormError(null);
    setStep("submit");

    const result = await submitPublicWaiver(body);
    if (!result.ok) {
      setSubmitting(false);
      setStep("review");
      setFormError(result.message);
      if (result.code === "validation") {
        // Keep entered data; stay on review so the user can go back and fix.
      }
      if (
        result.code === "idempotency_conflict" ||
        result.code === "incomplete_prior_state"
      ) {
        idempotencyRef.current = null;
      }
      return;
    }

    // Navigate with the server-issued completion token only (not PII).
    const completionParams = new URLSearchParams();
    if (isFacilityPartyWaiver) {
      completionParams.set("source", "facility-party");
      completionParams.set("booking", searchParams.get("booking") ?? "");
      if (facilityPartyDate) completionParams.set("date", facilityPartyDate);
      if (searchParams.get("arrival") === "1") completionParams.set("arrival", "1");
    }
    completionParams.set("lang", language);
    const completionQuery = completionParams.toString();
    router.replace(
      `/waiver/complete/${encodeURIComponent(result.publicToken)}${
        completionQuery ? `?${completionQuery}` : ""
      }`,
    );
  };

  const stepTitle =
    step === "signer"
      ? t.signerStep
      : step === "participants"
        ? t.participantsStep
        : step === "legal"
          ? t.legalStep
          : step === "signature"
            ? t.signatureStep
            : step === "submit"
              ? t.submitStep
              : t.reviewStep;
  const facilityPartyDate = searchParams.get("date");
  const isFacilityPartyWaiver =
    searchParams.get("source") === "facility-party" &&
    Boolean(searchParams.get("booking"));

  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-xl rounded-[1.75rem] border-2 border-white bg-white/95 px-4 py-6 shadow-[0_18px_48px_rgba(8,145,178,0.16)] sm:px-7 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-800">
            {t.waiver}
          </p>
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-50 px-5 text-sm font-black text-cyan-950 transition hover:bg-cyan-100"
          >
            {t.website}
          </Link>
        </div>
        <label className="mt-4 block rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-950">
          {t.chooseLanguage}
          <select
            value={language}
            onChange={(event) => setLanguage(parseWaiverLanguage(event.target.value))}
            className="mt-2 min-h-12 w-full rounded-xl border-2 border-cyan-300 bg-white px-3 text-base font-black text-slate-950"
          >
            {WAIVER_LANGUAGES.map((item) => (
              <option key={item} value={item}>{waiverLanguageNames[item]}</option>
            ))}
          </select>
        </label>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-balance text-3xl font-black tracking-tight outline-none sm:text-4xl"
        >
          {stepTitle}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {t.intro}
        </p>
        {isFacilityPartyWaiver ? (
          <div className="mt-4 rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold leading-relaxed text-orange-950">
            <p>{t.partyWaiver}</p>
            <p className="mt-1 font-semibold">
              {t.partyHelp}{facilityPartyDate ? ` ${facilityPartyDate}` : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <WaiverStepProgress current={step === "submit" ? "review" : step} language={language} />
        </div>

        <form className="mt-8 space-y-6" onSubmit={onSubmit} noValidate>
          {formError ? (
            <div
              role="alert"
              className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
            >
              {formError}
            </div>
          ) : null}

          {step === "signer" ? (
            <div className="space-y-4">
              <ErrorSummary errors={errors} titleId={errorTitleId} language={language} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  {t.legalFirst}
                  <input
                    className={fieldClass}
                    autoComplete="given-name"
                    value={state.signer.firstName}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        signer: { ...prev.signer, firstName: e.target.value },
                      }))
                    }
                    aria-invalid={Boolean(errors.firstName)}
                  />
                  {errors.firstName ? (
                    <span className="mt-1 block text-sm font-semibold text-red-700">
                      {localizeWaiverError(errors.firstName, language)}
                    </span>
                  ) : null}
                </label>
                <label className="block text-sm font-bold text-slate-800">
                  {t.legalLast}
                  <input
                    className={fieldClass}
                    autoComplete="family-name"
                    value={state.signer.lastName}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        signer: { ...prev.signer, lastName: e.target.value },
                      }))
                    }
                    aria-invalid={Boolean(errors.lastName)}
                  />
                  {errors.lastName ? (
                    <span className="mt-1 block text-sm font-semibold text-red-700">
                      {localizeWaiverError(errors.lastName, language)}
                    </span>
                  ) : null}
                </label>
              </div>
              <label className="block text-sm font-bold text-slate-800">
                {t.email}
                <input
                  type="email"
                  inputMode="email"
                  className={fieldClass}
                  autoComplete="email"
                  value={state.signer.email}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      signer: { ...prev.signer, email: e.target.value },
                    }))
                  }
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <span className="mt-1 block text-sm font-semibold text-red-700">
                    {localizeWaiverError(errors.email, language)}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm font-bold text-slate-800">
                {t.phone}
                <input
                  type="tel"
                  inputMode="tel"
                  className={fieldClass}
                  autoComplete="tel"
                  value={state.signer.phone}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      signer: { ...prev.signer, phone: e.target.value },
                    }))
                  }
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone ? (
                  <span className="mt-1 block text-sm font-semibold text-red-700">
                    {localizeWaiverError(errors.phone, language)}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm font-bold text-slate-800">
                {t.dob}
                <input
                  type="date"
                  className={fieldClass}
                  value={state.signer.dob}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      signer: { ...prev.signer, dob: e.target.value },
                    }))
                  }
                  aria-invalid={Boolean(errors.dob)}
                />
                {errors.dob ? (
                  <span className="mt-1 block text-sm font-semibold text-red-700">
                    {localizeWaiverError(errors.dob, language)}
                  </span>
                ) : null}
              </label>
            </div>
          ) : null}

          {step === "participants" ? (
            <div className="space-y-4">
              <ErrorSummary errors={errors} titleId={errorTitleId} language={language} />
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                <p className="font-black">{t.guardianRule}</p>
                <p className="mt-1">
                  {t.guardianHelp}
                </p>
              </div>

              <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                  {t.adultSigner}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-950">
                  {state.signer.firstName} {state.signer.lastName}
                </p>
                <p className="text-sm text-slate-600">
                  {t.includedSigner}
                </p>
              </div>

              {state.participants.map((participant, index) => (
                <ParticipantCard
                  key={participant.tempId}
                  index={index}
                  participant={participant}
                  signer={state.signer}
                  allParticipants={state.participants}
                  errors={errors}
                  onChange={(next) =>
                    setState((prev) => ({
                      ...prev,
                      participants: prev.participants.map((row, i) =>
                        i === index ? next : row,
                      ),
                    }))
                  }
                  onRemove={() =>
                    setState((prev) => ({
                      ...prev,
                      participants: prev.participants.filter((_, i) => i !== index),
                    }))
                  }
                  language={language}
                />
              ))}

              <button
                type="button"
                className={secondaryBtnClass}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    participants: [...prev.participants, createParticipantDraft()],
                  }))
                }
              >
                {t.addParticipant}
              </button>
            </div>
          ) : null}

          {step === "legal" ? (
            <div className="space-y-4">
              <ErrorSummary errors={errors} titleId={errorTitleId} language={language} />

              {templateLoading ? (
                <div
                  role="status"
                  className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-4 text-sm font-semibold text-cyan-950"
                >
                  {t.loadingTerms}
                </div>
              ) : state.legalTemplateAvailable && state.legalBodyHtml ? (
                <div className="space-y-2">
                  {state.legalVersionLabel ? (
                    <p className="text-sm font-bold text-slate-700">
                      {state.legalVersionLabel}
                    </p>
                  ) : null}
                  {translatedLegalHtml ? (
                    <>
                      <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-950">{t.englishControls}</p>
                      <div className="max-h-[50vh] overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-900 sm:text-base" dangerouslySetInnerHTML={{ __html: translatedLegalHtml }} />
                      <details className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer font-black text-slate-900">English — {t.courtesyTitle}</summary>
                        <div className="mt-3 max-h-[45vh] overflow-y-auto text-sm leading-7 text-slate-900" dangerouslySetInnerHTML={{ __html: state.legalBodyHtml }} />
                      </details>
                    </>
                  ) : (
                    <div className="max-h-[50vh] overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-900 sm:text-base" dangerouslySetInnerHTML={{ __html: state.legalBodyHtml }} />
                  )}
                </div>
              ) : (
                <div
                  role="alert"
                  className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950"
                >
                  <p className="font-black">{t.legalUnavailable}</p>
                  <p className="mt-2">
                    {templateLoadError ??
                      messageForPublicWaiverError("missing_template")}
                  </p>
                  <p className="mt-2 font-semibold">
                    {t.legalBlocked}
                  </p>
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="text-base font-black text-slate-950">
                  {t.consents}
                </legend>
                <p className="text-sm text-slate-600">
                  {t.noPrecheck}
                </p>

                <label className="flex min-h-14 items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-orange-600"
                    checked={state.consent.acknowledgedRisk === true}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        consent: {
                          ...prev.consent,
                          acknowledgedRisk: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="text-sm font-semibold leading-6 text-slate-900">
                    {t.risk}
                    {errors.acknowledgedRisk ? (
                      <span className="mt-1 block font-bold text-red-700">
                        {localizeWaiverError(errors.acknowledgedRisk, language)}
                      </span>
                    ) : null}
                  </span>
                </label>

                <label className="flex min-h-14 items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-orange-600"
                    checked={state.consent.acknowledgedTerms === true}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        consent: {
                          ...prev.consent,
                          acknowledgedTerms: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="text-sm font-semibold leading-6 text-slate-900">
                    {t.terms}
                    {errors.acknowledgedTerms ? (
                      <span className="mt-1 block font-bold text-red-700">
                        {localizeWaiverError(errors.acknowledgedTerms, language)}
                      </span>
                    ) : null}
                  </span>
                </label>

                <label className="flex min-h-14 items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-orange-600"
                    checked={state.consent.isLegalGuardian === true}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        consent: {
                          ...prev.consent,
                          isLegalGuardian: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="text-sm font-semibold leading-6 text-slate-900">
                    {t.guardianConsent}
                    {errors.isLegalGuardian ? (
                      <span className="mt-1 block font-bold text-red-700">
                        {localizeWaiverError(errors.isLegalGuardian, language)}
                      </span>
                    ) : null}
                  </span>
                </label>
              </fieldset>
            </div>
          ) : null}

          {step === "signature" ? (
            <div className="space-y-4">
              <ErrorSummary errors={errors} titleId={errorTitleId} language={language} />
              <SignaturePad
                disabled={submitting}
                error={(errors.signature || errors.signatureContentType)
                  ? localizeWaiverError(errors.signature || errors.signatureContentType, language)
                  : undefined}
                language={language}
                onSignatureChange={({ present, contentType }) =>
                  setState((prev) => ({
                    ...prev,
                    signaturePresent: present,
                    signatureContentType: contentType,
                  }))
                }
              />
              <p className="text-xs leading-5 text-slate-500">
                {t.signNote}
              </p>
            </div>
          ) : null}

          {step === "review" || step === "submit" ? (
            <div className="space-y-4">
              <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  {t.signer}
                </h2>
                <p className="mt-1 font-bold text-slate-950">
                  {state.signer.firstName} {state.signer.lastName}
                </p>
                <p className="text-sm text-slate-600">{state.signer.email}</p>
                <p className="text-sm text-slate-600">{state.signer.phone}</p>
                <p className="text-sm text-slate-600">DOB {state.signer.dob}</p>
              </div>

              <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  {t.participants}
                </h2>
                <ul className="mt-2 space-y-2">
                  <li className="text-sm font-semibold text-slate-900">
                    {state.signer.firstName} {state.signer.lastName} — {t.adult}
                  </li>
                  {state.participants.map((p) => (
                    <li key={p.tempId} className="text-sm font-semibold text-slate-900">
                      {p.firstName} {p.lastName} — {p.kind === "child" ? t.child : t.coveredAdult}
                      {p.kind === "child"
                        ? ` (${t.guardianSelected})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900">
                <p>
                  {t.consentsStatus}:{" "}
                  {state.consent.acknowledgedRisk &&
                  state.consent.acknowledgedTerms &&
                  state.consent.isLegalGuardian
                    ? t.allChecked
                    : t.incomplete}
                </p>
                <p className="mt-2">
                  {t.signature}: {state.signaturePresent ? t.provided : t.missing}
                </p>
                <p className="mt-2">
                  {t.legalText}:{" "}
                  {state.legalTemplateAvailable
                    ? t.loaded
                    : t.unavailable}
                </p>
              </div>

              {submitting ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-950"
                >
                  {t.submitting}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-7 sm:px-7">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {step !== "signer" && step !== "submit" ? (
                <button type="button" className={secondaryBtnClass} onClick={goBack}>
                  {t.back}
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}

              {step === "review" ? (
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={
                    submitting ||
                    templateLoading ||
                    !state.legalTemplateAvailable ||
                    !state.templateVersionId.trim() ||
                    !state.legalBodyHtml
                  }
                  onClick={(event) => {
                    void onSubmit(event);
                  }}
                >
                  {submitting ? t.submitStep : t.submit}
                </button>
              ) : step !== "submit" ? (
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={
                    step === "legal" &&
                    (templateLoading ||
                      !state.legalTemplateAvailable ||
                      !state.templateVersionId.trim() ||
                      !state.legalBodyHtml)
                  }
                  onClick={goNext}
                >
                  {t.continue}
                </button>
              ) : null}
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          {t.help}{" "}
          <Link href="/contact" className="font-bold text-cyan-800 underline">
            {t.contact}
          </Link>
        </p>
      </section>
    </main>
  );
}
