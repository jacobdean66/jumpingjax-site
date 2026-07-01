import Link from "next/link";

import type {
  OperationsAvailability,
  OperationsSubsystemOverview,
} from "./types";

function EmptyValue() {
  return <span className="text-slate-400">None</span>;
}

function availabilityTone(kind: OperationsAvailability["kind"]): string {
  switch (kind) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "empty":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "scoped_only":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "storage_unavailable":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "bridge_misconfigured":
    case "read_error":
      return "border-rose-200 bg-rose-50 text-rose-950";
  }
}

function availabilityLabel(kind: OperationsAvailability["kind"]): string {
  switch (kind) {
    case "available":
      return "Available";
    case "empty":
      return "Empty";
    case "scoped_only":
      return "Scoped only";
    case "storage_unavailable":
      return "Storage unavailable";
    case "bridge_misconfigured":
      return "Bridge misconfigured";
    case "read_error":
      return "Read error";
  }
}

function RecordCountsList({ counts }: { counts: Record<string, number> | null }) {
  if (!counts) return <EmptyValue />;
  const entries = Object.entries(counts);
  if (entries.length === 0) return <EmptyValue />;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700"
        >
          {key}: {value}
        </span>
      ))}
    </div>
  );
}

function hrefWithToken(href: string, token: string): string {
  if (!token) return href;
  return href.includes("?")
    ? `${href}&token=${encodeURIComponent(token)}`
    : `${href}?token=${encodeURIComponent(token)}`;
}

function SubsystemCard({
  subsystem,
  token,
}: {
  subsystem: OperationsSubsystemOverview;
  token: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            {subsystem.label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${availabilityTone(subsystem.availability.kind)}`}
            >
              {availabilityLabel(subsystem.availability.kind)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
              bridge: {subsystem.bridgeStatus}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
        {subsystem.description}
      </p>

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
        {subsystem.availability.message}
        {subsystem.availability.code ? (
          <p className="mt-1 font-mono text-xs text-slate-500">{subsystem.availability.code}</p>
        ) : null}
      </div>

      {subsystem.recordCounts ? (
        <div className="mt-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Record counts
          </p>
          <div className="mt-2">
            <RecordCountsList counts={subsystem.recordCounts as Record<string, number>} />
          </div>
        </div>
      ) : null}

      {subsystem.replaySummary ? (
        <div className="mt-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Replay summary
          </p>
          <div className="mt-2">
            <RecordCountsList counts={subsystem.replaySummary as Record<string, number>} />
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <Link
          href={hrefWithToken(subsystem.detailHref, token)}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-black text-slate-950 hover:bg-slate-50"
        >
          Open subsystem
        </Link>
      </div>
    </article>
  );
}

export default function SubsystemOverviewGrid({
  subsystems,
  token,
}: {
  subsystems: readonly OperationsSubsystemOverview[];
  token: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {subsystems.map((subsystem) => (
        <SubsystemCard key={subsystem.key} subsystem={subsystem} token={token} />
      ))}
    </div>
  );
}
