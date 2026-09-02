"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import type { AgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import type { SocialSourceImage } from "@/lib/social-posts/social-source-images";
import type {
  SocialDraftCheckpoint,
  SocialDraftNextStage,
} from "@/lib/social-posts/agents/staged-workflow-types";
import SourceImageField from "./SourceImageField";

type Props = {
  token: string;
  sourceImages: SocialSourceImage[];
  agentUiProtection: AgentUiProtectionStatus;
  initialGoal?: string;
  initialTheme?: string;
};

type WorkflowStage = {
  stageId?: string;
  status?: "pending" | "running" | "completed" | "failed" | "skipped" | "not_needed";
  summary?: string;
};

function workflowModuleClasses(status: "passed" | "blocked" | "empty"): string {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

type StagedDraftResponse = {
  ok?: boolean;
  error?: string;
  blocked?: boolean;
  stopped?: boolean;
  checkpoint?: SocialDraftCheckpoint;
  checkpointSignature?: string;
  post?: { id?: string; title?: string };
  publication?: { published?: boolean; note?: string };
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

const STAGE_LABELS: Record<string, string> = {
  campaign_strategist: "Campaign Strategist",
  creative_director: "Creative Director",
  independent_reviewer: "Independent Reviewer",
  deterministic_compliance: "Deterministic Compliance",
  creative_director_revision: "Revision",
  final_deterministic_compliance: "Deterministic Compliance",
  owner_ready: "Owner Approval Required",
};

const NEXT_STAGE_LABELS: Record<SocialDraftNextStage, string> = {
  creative_director: "Creative Director",
  independent_reviewer: "Independent Reviewer",
  compliance: "Deterministic Compliance",
  revision: "Creative Director Revision",
  final_compliance: "Final Deterministic Compliance",
  persist: "Save owner-ready draft",
  blocked: "Blocked / stopped",
  complete: "Complete",
};

function formatStageLine(stage: WorkflowStage): string | null {
  if (!stage.stageId) return null;
  const label = STAGE_LABELS[stage.stageId] ?? stage.stageId;
  if (stage.status === "completed") return `${label}: completed`;
  if (stage.status === "failed") return `${label}: failed`;
  if (stage.status === "skipped") return `${label}: skipped`;
  if (stage.status === "not_needed") return `${label}: not needed`;
  if (stage.status === "running") return `${label}: running`;
  return null;
}

export default function AgentDraftForm({
  token,
  sourceImages,
  agentUiProtection,
  initialGoal = "",
  initialTheme = "",
}: Props) {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string>(initialGoal ? CUSTOM_GOAL_VALUE : PREMADE_GOALS[0]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState<SocialDraftCheckpoint | null>(null);
  const [checkpointSignature, setCheckpointSignature] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const modelActionsDisabled = agentUiProtection.modelActionsDisabled;
  const workflowActive = Boolean(
    checkpoint && checkpoint.nextStage !== "blocked" && checkpoint.nextStage !== "complete",
  );

  function applyCheckpoint(next: SocialDraftCheckpoint, signature: string): void {
    setCheckpoint(next);
    setCheckpointSignature(signature);
    setCompletedStages(
      next.stages
        .map(formatStageLine)
        .filter((line): line is string => Boolean(line)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modelActionsDisabled || inFlightRef.current || pending) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    inFlightRef.current = true;
    setPending(true);
    setMessage(null);
    setError(null);
    setCompletedStages([]);
    setAgentStatus("Running Campaign Strategist only. No later agent has permission yet.");

    const customGoal = String(form.get("custom_goal") ?? "").trim();
    const goal = selectedGoal === CUSTOM_GOAL_VALUE ? customGoal : selectedGoal;

    try {
      const response = await fetch("/api/social-posts/agent-draft/stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action: "start",
          campaignId: String(form.get("campaignId") ?? ""),
          goal,
          platform: String(form.get("platform") ?? "both"),
          mediaType: String(form.get("mediaType") ?? "image"),
          businessFocus: String(form.get("businessFocus") ?? "facility-parties"),
          source_image_url: String(form.get("source_image_url") ?? ""),
          theme: String(form.get("theme") ?? ""),
        }),
      });
      const data = (await response.json()) as StagedDraftResponse;

      if (!response.ok || !data.ok || !data.checkpoint || !data.checkpointSignature) {
        throw new Error(data.error ?? "Campaign Strategist could not start.");
      }
      applyCheckpoint(data.checkpoint, data.checkpointSignature);
      setAgentStatus("Campaign Strategist finished. The Creative Director has not run.");
      setMessage("Review the strategy below. Continue only if it makes sense; otherwise stop without another model call.");
    } catch (caught) {
      setAgentStatus(null);
      setError(caught instanceof Error ? caught.message : "AI draft failed.");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  async function continueWorkflow(): Promise<void> {
    if (!checkpoint || !checkpointSignature || pending || inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    const label = NEXT_STAGE_LABELS[checkpoint.nextStage];
    setAgentStatus(`Running ${label} only…`);
    try {
      const response = await fetch("/api/social-posts/agent-draft/stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action: "continue", checkpoint, checkpointSignature }),
      });
      const data = (await response.json()) as StagedDraftResponse;
      if (!response.ok || !data.ok || !data.checkpoint || !data.checkpointSignature) {
        throw new Error(data.error ?? `${label} failed.`);
      }
      applyCheckpoint(data.checkpoint, data.checkpointSignature);
      if (data.checkpoint.nextStage === "complete") {
        setAgentStatus("Owner-ready draft saved. Nothing was published or scheduled.");
        setMessage(data.publication?.note ?? "Draft saved for owner review.");
        setSelectedGoal(PREMADE_GOALS[0]);
        router.refresh();
      } else if (data.checkpoint.nextStage === "blocked") {
        setAgentStatus("Workflow stopped at a hard gate.");
        setError(data.publication?.note ?? "The workflow was blocked before persistence.");
      } else {
        setAgentStatus(`${label} finished. ${NEXT_STAGE_LABELS[data.checkpoint.nextStage]} has not run.`);
        setMessage("Inspect the newest checkpoint below before allowing another agent or save step.");
      }
    } catch (caught) {
      setAgentStatus(null);
      setError(caught instanceof Error ? caught.message : `${label} failed.`);
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  async function stopWorkflow(): Promise<void> {
    if (!checkpoint || !checkpointSignature || pending || inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/social-posts/agent-draft/stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action: "stop", checkpoint, checkpointSignature }),
      });
      const data = (await response.json()) as StagedDraftResponse;
      if (!response.ok || !data.ok || !data.checkpoint || !data.checkpointSignature) {
        throw new Error(data.error ?? "Workflow could not be stopped.");
      }
      applyCheckpoint(data.checkpoint, data.checkpointSignature);
      setAgentStatus("Workflow stopped by owner.");
      setMessage("No later agent ran, no post was saved, and nothing was published.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workflow stop failed.");
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
        <h2 className="mt-1 text-2xl font-black">
          Multi-agent Social Posts workflow
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Run one agent at a time. Each result stops at an owner checkpoint so
          you can inspect it before spending another model call. Deterministic
          compliance and visual-realism gates must pass before a draft can be
          saved. Nothing is published or scheduled here.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {agentUiProtection.complianceWaitingLabel}
          {modelActionsDisabled && agentUiProtection.reason
            ? ` — ${agentUiProtection.reason}`
            : ""}
        </p>
      </div>

      {modelActionsDisabled && agentUiProtection.reason ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950"
        >
          {agentUiProtection.reason}
        </div>
      ) : null}

      {agentStatus ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          {pending ? "Running: " : "Last run: "}
          {agentStatus}
        </div>
      ) : null}

      {completedStages.length > 0 ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Workflow stages
          </p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-800">
            {completedStages.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
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
            disabled={workflowActive}
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
            disabled={workflowActive}
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
            Choose a goal so the agents know what kind of post to create.
          </span>
        </label>

        {selectedGoal === CUSTOM_GOAL_VALUE ? (
          <label className="block lg:col-span-4">
            <span className="text-sm font-black text-slate-700">Custom goal</span>
            <input
              name="custom_goal"
              defaultValue={initialGoal}
              disabled={workflowActive}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Describe the post goal"
            />
          </label>
        ) : null}

        <label className="block lg:col-span-4">
          <span className="text-sm font-black text-slate-700">Party theme</span>
          <input
            name="theme"
            defaultValue={initialTheme}
            disabled={workflowActive}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Sonic, Minecraft, princess, dinosaurs…"
          />
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            Uses the Facility Party / Invitation Agent matcher, approved artwork,
            licensed illustration libraries, and theme palette.
          </span>
        </label>

        <label className="block lg:col-span-4">
          <span className="text-sm font-black text-slate-700">
            Reference image or approved theme artwork
          </span>
          <div className="mt-1">
            <SourceImageField images={sourceImages} disabled={workflowActive} />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Platform</span>
          <select
            name="platform"
            defaultValue="both"
            disabled={workflowActive}
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
            defaultValue="image"
            disabled={workflowActive}
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
            defaultValue="facility-parties"
            disabled={workflowActive}
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
            disabled={pending || modelActionsDisabled || workflowActive}
            aria-busy={pending}
            title={
              modelActionsDisabled
                ? (agentUiProtection.reason ?? undefined)
                : undefined
            }
            className="min-h-11 w-full rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && !checkpoint
              ? "Running Campaign Strategist…"
              : modelActionsDisabled
                ? "Create AI Draft unavailable"
                : workflowActive
                  ? "Review checkpoint below"
                  : "Run Campaign Strategist"}
          </button>
        </div>
      </form>

      {checkpoint ? (
        <div className="mt-5 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                Owner checkpoint
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                {checkpoint.nextStage === "complete"
                  ? "Owner-ready draft saved"
                  : checkpoint.nextStage === "blocked"
                    ? "Workflow stopped"
                    : `${NEXT_STAGE_LABELS[checkpoint.nextStage]} has not run`}
              </h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
              {checkpoint.modelCallsUsed} of 4 model calls used
            </span>
          </div>

          {checkpoint.themeContext ? (
            <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">
                Theme match: {checkpoint.themeContext.themeLabel} ({checkpoint.themeContext.themeId})
              </p>
              <p className="mt-1 font-semibold">
                Libraries: {checkpoint.themeContext.attachedLibraries.join(", ") || "none"}
              </p>
              <p className="mt-1 font-semibold">
                Palette: {Object.values(checkpoint.themeContext.palette).join(" · ")}
              </p>
              <p className="mt-1 break-all text-xs font-semibold text-slate-600">
                Reference: {checkpoint.selectedSourceImageUrl ?? checkpoint.themeContext.heroPath}
              </p>
            </div>
          ) : null}

          {checkpoint.workflowContext ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">Workflow inputs passed in</p>
              <div className="mt-3 space-y-2">
                {checkpoint.workflowContext.modules.map((module) => (
                  <div key={module.moduleId} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{module.label}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${workflowModuleClasses(module.status)}`}
                      >
                        {module.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {module.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {checkpoint.strategist ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">Campaign Strategist</p>
              <p className="mt-2"><strong>Objective:</strong> {checkpoint.strategist.campaignObjective}</p>
              <p className="mt-1"><strong>Audience:</strong> {checkpoint.strategist.audience}</p>
              <p className="mt-1"><strong>Angle:</strong> {checkpoint.strategist.angleMessage}</p>
              <p className="mt-1"><strong>CTA:</strong> {checkpoint.strategist.ctaIntent}</p>
              {checkpoint.strategist.ownerInputRequired.length > 0 ? (
                <p className="mt-2 font-bold text-amber-800">
                  Owner input needed: {checkpoint.strategist.ownerInputRequired.join("; ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {checkpoint.creative ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">Creative Director</p>
              <p className="mt-2 text-lg font-black">{checkpoint.creative.title}</p>
              <p className="mt-2 whitespace-pre-wrap font-semibold">{checkpoint.creative.caption}</p>
              <details className="mt-3">
                <summary className="cursor-pointer font-black">Visual direction and generation prompt</summary>
                <p className="mt-2">{checkpoint.creative.visualDirection}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {checkpoint.creative.generationPrompt}
                </p>
              </details>
            </div>
          ) : null}

          {checkpoint.creativeQuality && !checkpoint.creativeQuality.allowed ? (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-950">
              Creative quality gate stopped this run: {checkpoint.creativeQuality.findings.join("; ")}
            </div>
          ) : null}

          {checkpoint.diagnostics.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <p className="font-black uppercase tracking-[0.12em]">Agent diagnostics</p>
              <ul className="mt-2 space-y-1">
                {checkpoint.diagnostics.map((item) => (
                  <li key={item.requestId}>
                    <strong>{item.agentId}:</strong> {item.source}
                    {item.model ? ` · ${item.model}` : ""}
                    {item.failureKind ? ` · ${item.failureKind}` : ""}
                    {item.fallbackReason ? ` — ${item.fallbackReason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {checkpoint.reviewer ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">
                Independent Reviewer: {checkpoint.reviewer.verdict.toUpperCase()}
              </p>
              <p className="mt-2">{checkpoint.reviewer.reasoning}</p>
              {checkpoint.reviewer.flags.length > 0 ? (
                <p className="mt-2 font-bold text-amber-800">Flags: {checkpoint.reviewer.flags.join("; ")}</p>
              ) : null}
              {checkpoint.reviewer.revisionInstructions.length > 0 ? (
                <p className="mt-1 font-semibold">
                  Revision instructions: {checkpoint.reviewer.revisionInstructions.join("; ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {(checkpoint.finalCompliance ?? checkpoint.compliance) ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <p className="font-black">
                Deterministic Compliance: {(checkpoint.finalCompliance ?? checkpoint.compliance)!.decision.toUpperCase()}
              </p>
              <p className="mt-2">{(checkpoint.finalCompliance ?? checkpoint.compliance)!.summary}</p>
              {(checkpoint.finalCompliance ?? checkpoint.compliance)!.blockingCodes.length > 0 ? (
                <p className="mt-2 font-bold text-rose-800">
                  Blocking codes: {(checkpoint.finalCompliance ?? checkpoint.compliance)!.blockingCodes.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {workflowActive ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={continueWorkflow}
                disabled={pending}
                className="min-h-11 flex-1 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {pending ? `Running ${NEXT_STAGE_LABELS[checkpoint.nextStage]}…` : `Run ${NEXT_STAGE_LABELS[checkpoint.nextStage]}`}
              </button>
              <button
                type="button"
                onClick={stopWorkflow}
                disabled={pending}
                className="min-h-11 rounded-full border-2 border-rose-300 bg-white px-5 py-2 text-sm font-black text-rose-800 hover:bg-rose-50 disabled:opacity-60"
              >
                Stop without another agent
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCheckpoint(null);
                setCheckpointSignature(null);
                setCompletedStages([]);
                setAgentStatus(null);
                setMessage(null);
                setError(null);
              }}
              className="mt-4 min-h-11 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-800"
            >
              Start a new workflow
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
