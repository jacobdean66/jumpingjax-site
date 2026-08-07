"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
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
  agent?: {
    agentId?: string;
    source?: "model" | "deterministic-fallback";
    provider?: string;
    model?: string | null;
    requestId?: string;
    fallbackReason?: string | null;
    failureKind?: string | null;
  };
  compliance?: {
    deterministic?: boolean;
    resultState?: string;
    decision?: "allow" | "quarantine" | "block";
    summary?: string;
    allowedToProceed?: boolean;
  };
  generationReady?: boolean;
  generationReadyReason?: string;
  workflow?: {
    independentReviewerImplemented?: boolean;
    ownerApprovalRequired?: boolean;
    note?: string;
  };
  strategy?: {
    ownerInputRequired?: string[];
    factualConstraints?: string[];
  };
  publication?: {
    published?: boolean;
    note?: string;
  };
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
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || pending) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    inFlightRef.current = true;
    setPending(true);
    setMessage(null);
    setError(null);
    setAgentStatus("Social Strategy / Copy Agent running…");

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
        const complianceDecision = data.compliance?.decision;
        const prefix =
          complianceDecision === "block"
            ? "Blocked by deterministic compliance. "
            : complianceDecision === "quarantine"
              ? "Quarantined by deterministic compliance. "
              : "";
        throw new Error(
          `${prefix}${data.error ?? "AI draft could not be created."}`,
        );
      }

      const sourceLabel =
        data.agent?.source === "model"
          ? "model-backed"
          : data.agent?.source === "deterministic-fallback"
            ? "deterministic fallback"
            : "unknown";
      const ownerNeeds = data.strategy?.ownerInputRequired?.length
        ? ` Owner input needed: ${data.strategy.ownerInputRequired.slice(0, 2).join(" ")}`
        : "";
      const complianceDecision = data.compliance?.decision ?? null;
      const complianceNote = data.compliance?.summary
        ? ` Compliance: ${complianceDecision ?? "unknown"} — ${data.compliance.summary}`
        : "";
      const quarantineLabel =
        complianceDecision === "quarantine"
          ? " QUARANTINE working draft only — not compliant, not publishable, not generation-ready."
          : "";
      const generationNote = data.generationReadyReason
        ? ` ${data.generationReadyReason}`
        : " Paid generation remains locked until compliance allow on the exact prompt.";
      const workflowNote =
        data.workflow?.independentReviewerImplemented === false
          ? " No Independent Reviewer agent. Owner approval required."
          : "";

      setSelectedGoal(PREMADE_GOALS[0]);
      if (formElement) {
        formElement.reset();
      }
      setAgentStatus(
        `Social Strategy / Copy Agent ${sourceLabel}${
          data.agent?.model ? ` (${data.agent.model})` : ""
        }${data.agent?.failureKind ? ` [${data.agent.failureKind}]` : ""}.`,
      );
      setMessage(
        `AI draft created (${sourceLabel}). Not published.${ownerNeeds}${complianceNote}${quarantineLabel}${generationNote}${workflowNote}`,
      );
      router.refresh();
    } catch (caught) {
      setAgentStatus(null);
      setError(caught instanceof Error ? caught.message : "AI draft failed.");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Create AI Draft
        </p>
        <h2 className="mt-1 text-2xl font-black">Social Strategy / Copy Agent</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Creates a structured draft plan only. Deterministic compliance runs
          after the model. Nothing is published from this action. No Independent
          Reviewer agent exists — owner approval remains mandatory.
        </p>
      </div>

      {agentStatus ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          {pending ? "Running: " : "Last run: "}
          {agentStatus}
        </div>
      ) : null}
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
            Campaigns guide strategy while the goal can still refine the post.
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
            aria-busy={pending}
            className="min-h-11 w-full rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Social Strategy Agent…" : "Create AI Draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
