"use client";

import type { CoveredParticipantDraft, SignerFormState } from "@/lib/waivers/public-form";
import { adultOptionsForGuardian } from "@/lib/waivers/public-form";

type ParticipantCardProps = {
  index: number;
  participant: CoveredParticipantDraft;
  signer: SignerFormState;
  allParticipants: CoveredParticipantDraft[];
  errors: Record<string, string>;
  onChange: (next: CoveredParticipantDraft) => void;
  onRemove: () => void;
};

const fieldClass =
  "mt-1.5 w-full min-h-12 rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-200";

export function ParticipantCard({
  index,
  participant,
  signer,
  allParticipants,
  errors,
  onChange,
  onRemove,
}: ParticipantCardProps) {
  const prefix = `participants.${index}`;
  const guardians = adultOptionsForGuardian(signer, allParticipants).filter(
    (option) => option.tempId !== participant.tempId,
  );

  return (
    <article className="rounded-3xl border-2 border-cyan-100 bg-cyan-50/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            Participant {index + 1}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Add every person covered by this waiver.
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-pink-200 bg-white px-4 text-sm font-bold text-pink-800 transition hover:bg-pink-50"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-800">
            First name
            <input
              className={fieldClass}
              autoComplete="given-name"
              value={participant.firstName}
              onChange={(e) =>
                onChange({ ...participant, firstName: e.target.value })
              }
              aria-invalid={Boolean(errors[`${prefix}.firstName`])}
            />
            {errors[`${prefix}.firstName`] ? (
              <span className="mt-1 block text-sm font-semibold text-red-700">
                {errors[`${prefix}.firstName`]}
              </span>
            ) : null}
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Last name
            <input
              className={fieldClass}
              autoComplete="family-name"
              value={participant.lastName}
              onChange={(e) =>
                onChange({ ...participant, lastName: e.target.value })
              }
              aria-invalid={Boolean(errors[`${prefix}.lastName`])}
            />
            {errors[`${prefix}.lastName`] ? (
              <span className="mt-1 block text-sm font-semibold text-red-700">
                {errors[`${prefix}.lastName`]}
              </span>
            ) : null}
          </label>
        </div>

        <label className="block text-sm font-bold text-slate-800">
          Date of birth
          <input
            type="date"
            className={fieldClass}
            value={participant.dob}
            onChange={(e) => onChange({ ...participant, dob: e.target.value })}
            aria-invalid={Boolean(errors[`${prefix}.dob`])}
          />
          {errors[`${prefix}.dob`] ? (
            <span className="mt-1 block text-sm font-semibold text-red-700">
              {errors[`${prefix}.dob`]}
            </span>
          ) : null}
        </label>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">
            Participant type
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label
              className={
                participant.kind === "child"
                  ? "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-orange-500 bg-orange-50 px-3 text-sm font-bold text-orange-950"
                  : "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"
              }
            >
              <input
                type="radio"
                className="sr-only"
                name={`${participant.tempId}-kind`}
                checked={participant.kind === "child"}
                onChange={() =>
                  onChange({
                    ...participant,
                    kind: "child",
                    guardianTempId:
                      participant.guardianTempId || guardians[0]?.tempId || null,
                  })
                }
              />
              Child
            </label>
            <label
              className={
                participant.kind === "adult"
                  ? "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-orange-500 bg-orange-50 px-3 text-sm font-bold text-orange-950"
                  : "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"
              }
            >
              <input
                type="radio"
                className="sr-only"
                name={`${participant.tempId}-kind`}
                checked={participant.kind === "adult"}
                onChange={() =>
                  onChange({
                    ...participant,
                    kind: "adult",
                    guardianTempId: null,
                  })
                }
              />
              Adult
            </label>
          </div>
        </fieldset>

        {participant.kind === "child" ? (
          <label className="block text-sm font-bold text-slate-800">
            Parent or legal guardian on this waiver
            <select
              className={fieldClass}
              value={participant.guardianTempId ?? ""}
              onChange={(e) =>
                onChange({
                  ...participant,
                  guardianTempId: e.target.value || null,
                })
              }
              aria-invalid={Boolean(errors[`${prefix}.guardianTempId`])}
            >
              <option value="">Select guardian</option>
              {guardians.map((g) => (
                <option key={g.tempId} value={g.tempId}>
                  {g.label}
                </option>
              ))}
            </select>
            {errors[`${prefix}.guardianTempId`] ? (
              <span className="mt-1 block text-sm font-semibold text-red-700">
                {errors[`${prefix}.guardianTempId`]}
              </span>
            ) : null}
          </label>
        ) : null}
      </div>
    </article>
  );
}
