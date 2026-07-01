import Link from "next/link";

import type {
  OperationsPipelineReferenceGroup,
  OperationsPipelineResult,
  OperationsPipelineStage,
  OperationsPipelineStageStatus,
} from "./types";

function EmptyValue() {
  return <span className="text-slate-400">None</span>;
}

function hrefWithToken(href: string, token: string): string {
  if (!token) return href;
  return href.includes("?")
    ? `${href}&token=${encodeURIComponent(token)}`
    : `${href}?token=${encodeURIComponent(token)}`;
}

function statusTone(status: OperationsPipelineStageStatus): string {
  switch (status) {
    case "found":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "empty":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "not_found":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "storage_unavailable":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "not_wired":
      return "border-sky-200 bg-sky-50 text-sky-950";
  }
}

function statusLabel(status: OperationsPipelineStageStatus): string {
  switch (status) {
    case "found":
      return "Found";
    case "empty":
      return "Empty";
    case "not_found":
      return "Not found";
    case "storage_unavailable":
      return "Storage unavailable";
    case "not_wired":
      return "Not wired";
  }
}

function ReferenceGroupPills({ group }: { group: OperationsPipelineReferenceGroup }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {group.label}
      </p>
      {group.ids.length === 0 ? (
        <p className="mt-1 text-sm">
          <EmptyValue />
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-2">
          {group.ids.map((id) => (
            <span
              key={id}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700"
            >
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StageNode({
  stage,
  token,
  isLast,
}: {
  stage: OperationsPipelineStage;
  token: string;
  isLast: boolean;
}) {
  return (
    <li className="relative pl-8">
      <span
        className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-black ${statusTone(stage.status)}`}
        aria-hidden
      >
        •
      </span>
      {!isLast ? (
        <span className="absolute left-[11px] top-7 h-[calc(100%+0.5rem)] w-px bg-slate-200" aria-hidden />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-slate-950">{stage.label}</h3>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${statusTone(stage.status)}`}
          >
            {statusLabel(stage.status)}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">{stage.summary}</p>

        {stage.referenceGroups.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {stage.referenceGroups.map((group) => (
              <ReferenceGroupPills key={group.label} group={group} />
            ))}
          </div>
        ) : null}

        {stage.href ? (
          <div className="mt-3">
            <Link
              href={hrefWithToken(stage.href, token)}
              className="inline-flex min-h-8 items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-950 hover:bg-slate-50"
            >
              Inspect scoped subsystem
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function PipelineExplainability({
  pipeline,
  token,
}: {
  pipeline: OperationsPipelineResult;
  token: string;
}) {
  return (
    <div>
      <div
        className={`rounded-2xl border p-4 text-sm ${
          pipeline.postFound
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <p className="font-black uppercase tracking-[0.12em]">
          Cross-System Pipeline for Social Post
        </p>
        <p className="mt-2 break-words font-mono text-xs">{pipeline.postId}</p>
        <p className="mt-2 leading-relaxed">
          {pipeline.postFound
            ? "This trace threads the same social post id through every subsystem below (read-only)."
            : "No social post row was found for this id. Downstream stages are still checked for orphaned references."}
        </p>
      </div>

      <ol className="mt-6 space-y-4">
        {pipeline.stages.map((stage, index) => (
          <StageNode
            key={stage.key}
            stage={stage}
            token={token}
            isLast={index === pipeline.stages.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
