import type { OperationsDiagnostic, OperationsDiagnosticSeverity } from "./types";

function severityTone(severity: OperationsDiagnosticSeverity): string {
  switch (severity) {
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-950";
  }
}

export default function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: readonly OperationsDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No diagnostics. All reachable subsystems reported healthy or expectedly empty state.
      </div>
    );
  }

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  const infoCount = diagnostics.filter((diagnostic) => diagnostic.severity === "info").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-rose-950">
          {errorCount} error(s)
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-950">
          {warningCount} warning(s)
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-950">
          {infoCount} info
        </span>
      </div>

      <div className="space-y-2">
        {diagnostics.map((diagnostic, index) => (
          <div
            key={`${diagnostic.subsystem}-${diagnostic.code}-${index}`}
            className={`rounded-xl border p-3 text-sm ${severityTone(diagnostic.severity)}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                {diagnostic.severity}
              </span>
              <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                {diagnostic.subsystem}
              </span>
              <p className="font-black">{diagnostic.code}</p>
            </div>
            <p className="mt-1 font-semibold">{diagnostic.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
