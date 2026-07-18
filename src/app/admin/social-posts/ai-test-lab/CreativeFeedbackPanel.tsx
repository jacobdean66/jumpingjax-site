"use client";

import { useMemo, useState } from "react";
import {
  describePreferenceForPreview,
  type CreativePreference,
  type CreativePreferenceAppliesTo,
} from "@/lib/social-posts/creative-preferences";

type Props = {
  initialPreferences: CreativePreference[];
};

const EMPTY = {
  title: "",
  naturalLanguageNote: "",
  subjectScale: "",
  ageRange: "",
  composition: "",
  cameraAngle: "",
  productVisibility: "",
  realism: "",
  brandStyle: "",
  prohibitedElements: "",
  preferredElements: "",
  appliesTo: "image" as CreativePreferenceAppliesTo,
};

export function CreativeFeedbackPanel({ initialPreferences }: Props) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [form, setForm] = useState(EMPTY);
  const [oneShotOnly, setOneShotOnly] = useState(false);
  const [doNotRemember, setDoNotRemember] = useState(false);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const previewText = useMemo(
    () => (preview ? preview : describePreferenceForPreview(form)),
    [preview, form],
  );

  const update = (key: keyof typeof EMPTY, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview("");
  };

  const run = async (action: "preview" | "save") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (doNotRemember || oneShotOnly) {
        if (action === "save") {
          setMessage(
            "Kept as one-shot feedback only — nothing was saved to AI memory.",
          );
          return;
        }
        setPreview(describePreferenceForPreview(form));
        setMessage("Preview ready (one-shot / do-not-remember — will not save).");
        return;
      }

      const res = await fetch("/api/admin/creative-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...form }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        preview?: string;
        preference?: CreativePreference;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Request failed.");

      if (action === "preview") {
        setPreview(data?.preview ?? describePreferenceForPreview(form));
        setMessage("Review the preference preview below, then save if it looks right.");
        return;
      }

      if (data?.preference) {
        setPreferences((current) => [data.preference!, ...current]);
        setForm(EMPTY);
        setPreview("");
        setMessage("Creative preference saved for future generations.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const mutatePreference = async (
    id: string,
    action: "delete" | "deactivate" | "activate",
  ) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/creative-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Update failed.");
      if (action === "delete") {
        setPreferences((current) => current.filter((pref) => pref.id !== id));
      } else {
        setPreferences((current) =>
          current.map((pref) =>
            pref.id === id
              ? { ...pref, isActive: action === "activate" }
              : pref,
          ),
        );
      }
      setMessage(`Preference ${action}d.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        Creative feedback & AI memory
      </p>
      <h2 className="mt-1 text-2xl font-black">Tell the AI what to remember</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Type feedback about a generated image, video, or post. Choose whether it
        applies once or becomes a reusable creative preference.
      </p>

      <div className="mt-4 grid gap-3">
        <label className="text-sm font-bold text-slate-700">
          Feedback note
          <textarea
            rows={3}
            value={form.naturalLanguageNote}
            onChange={(event) => update("naturalLanguageNote", event.target.value)}
            placeholder='Example: "The child is too large compared with the inflatable."'
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["subjectScale", "Subject scale"],
              ["ageRange", "Age range"],
              ["composition", "Composition"],
              ["cameraAngle", "Camera angle"],
              ["productVisibility", "Product visibility"],
              ["realism", "Realism"],
              ["brandStyle", "Brand style"],
              ["preferredElements", "Preferred elements"],
              ["prohibitedElements", "Prohibited elements"],
              ["title", "Preference title"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm font-bold text-slate-700">
              {label}
              <input
                value={form[key]}
                onChange={(event) => update(key, event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950"
              />
            </label>
          ))}
          <label className="text-sm font-bold text-slate-700">
            Applies to
            <select
              value={form.appliesTo}
              onChange={(event) =>
                update("appliesTo", event.target.value as CreativePreferenceAppliesTo)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950"
            >
              <option value="all">All generations</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="caption">Captions</option>
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={oneShotOnly}
            onChange={(event) => setOneShotOnly(event.target.checked)}
            className="mt-1"
          />
          Use for current generation only (do not save memory)
        </label>
        <label className="flex items-start gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={doNotRemember}
            onChange={(event) => setDoNotRemember(event.target.checked)}
            className="mt-1"
          />
          Explicitly mark as do-not-remember
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap font-semibold text-slate-800">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Preference preview (review before saving)
          </p>
          <p className="mt-2">{previewText || "Fill in feedback to preview."}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("preview")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black"
          >
            Preview preference
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("save")}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {oneShotOnly || doNotRemember
              ? "Keep as one-shot only"
              : "Save reusable preference"}
          </button>
        </div>

        {message ? (
          <p className="text-sm font-bold text-emerald-800">{message}</p>
        ) : null}
        {error ? <p className="text-sm font-bold text-rose-700">{error}</p> : null}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-black">Saved preferences</h3>
        {preferences.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-600">
            No reusable preferences saved yet.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {preferences.map((pref) => (
              <li
                key={pref.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              >
                <p className="font-black">
                  {pref.title || "Untitled"}{" "}
                  <span className="font-semibold text-slate-500">
                    ({pref.isActive ? "active" : "inactive"} · {pref.appliesTo})
                  </span>
                </p>
                <p className="mt-1 font-semibold text-slate-700">
                  {pref.naturalLanguageNote}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void mutatePreference(
                        pref.id,
                        pref.isActive ? "deactivate" : "activate",
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black"
                  >
                    {pref.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void mutatePreference(pref.id, "delete")}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-900"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
