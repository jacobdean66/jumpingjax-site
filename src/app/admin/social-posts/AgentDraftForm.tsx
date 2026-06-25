"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import type { SocialSourceImage } from "@/lib/social-posts/social-source-images";
import SourceImageField from "./SourceImageField";

type Props = {
  token: string;
  sourceImages: SocialSourceImage[];
};

type AgentDraftResponse = {
  ok?: boolean;
  error?: string;
};

const PREMADE_GOALS = [
  "Promote weekend inflatable rental openings",
  "Promote water slides for hot weather",
  "Promote birthday party bookings",
  "Promote indoor facility parties",
  "Promote last-minute rental availability",
  "Promote weekday party specials",
  "Promote church/daycare/school events",
  "Promote combo bounce house rentals",
  "Promote toddler-friendly inflatables",
  "Promote clean and safe local family fun",
  "Promote summer party rentals",
  "Promote private party bookings",
] as const;

const CUSTOM_GOAL_VALUE = "custom";

export default function AgentDraftForm({ token, sourceImages }: Props) {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string>(PREMADE_GOALS[0]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setPending(true);
    setMessage(null);
    setError(null);

    const customGoal = String(form.get("custom_goal") ?? "").trim();
    const goal = selectedGoal === CUSTOM_GOAL_VALUE ? customGoal : selectedGoal;

    try {
      const response = await fetch("/api/social-posts/agent-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          campaignId: String(form.get("campaignId") ?? ""),
          goal,
          platform: String(form.get("platform") ?? "both"),
          mediaType: String(form.get("mediaType") ?? "video"),
          businessFocus: String(form.get("businessFocus") ?? "both"),
          source_image_url: String(form.get("source_image_url") ?? ""),
        }),
      });
      const data = (await response.json()) as AgentDraftResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "AI draft could not be created.");
      }

      setSelectedGoal(PREMADE_GOALS[0]);
      if (formElement) {
        formElement.reset();
      }
      setMessage("AI draft created");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI draft failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Create AI Draft
        </p>
        <h2 className="mt-1 text-2xl font-black">Agent social post plan</h2>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-4">
        <label className="block lg:col-span-4">
          <span className="text-sm font-black text-slate-700">Campaign</span>
          <select
            name="campaignId"
            defaultValue=""
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            <option value="">Custom / no campaign</option>
            {SOCIAL_CAMPAIGNS.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            Campaigns guide the Creative Director rules while the goal can still refine the post.
          </span>
        </label>

        <label className="block lg:col-span-4">
          <span className="text-sm font-black text-slate-700">Post goal</span>
          <select
            name="goal"
            value={selectedGoal}
            onChange={(event) => setSelectedGoal(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            {PREMADE_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
            <option value={CUSTOM_GOAL_VALUE}>Custom goal</option>
          </select>
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            Choose a goal so the agent knows what kind of post to create.
          </span>
        </label>

        {selectedGoal === CUSTOM_GOAL_VALUE ? (
          <label className="block lg:col-span-4">
            <span className="text-sm font-black text-slate-700">Custom goal</span>
            <input
              name="custom_goal"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Describe the post goal"
            />
          </label>
        ) : null}

        <label className="block lg:col-span-4">
          <span className="text-sm font-black text-slate-700">
            Source image URL for video
          </span>
          <div className="mt-1">
            <SourceImageField images={sourceImages} />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Platform</span>
          <select
            name="platform"
            defaultValue="both"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            <option value="both">Both</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Media type</span>
          <select
            name="mediaType"
            defaultValue="video"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Business focus</span>
          <select
            name="businessFocus"
            defaultValue="both"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            <option value="both">Both</option>
            <option value="rentals">Rentals</option>
            <option value="facility-parties">Facility parties</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Creating..." : "Create AI Draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
