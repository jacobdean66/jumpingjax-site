import Link from "next/link";

type DeskSurface = "check-in" | "daily-report" | "corrections";

type Props = {
  active: DeskSurface;
  /** Owner-only destinations (daily report, corrections) are shown when true. */
  showOwnerTools?: boolean;
};

const linkClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 hover:border-slate-400";

const activeClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-700 bg-emerald-50 px-4 text-sm font-black text-emerald-900";

export function OpenPlayDeskNav({ active, showOwnerTools = false }: Props) {
  return (
    <nav
      aria-label="Open Play desk"
      className="mt-4 flex flex-wrap gap-2 print:hidden"
    >
      <Link
        href="/admin/check-in#check-in-desk"
        className={active === "check-in" ? activeClass : linkClass}
        aria-current={active === "check-in" ? "page" : undefined}
      >
        Check-in
      </Link>
      {showOwnerTools ? (
        <>
          <Link
            href="/admin/open-play-report#daily-report"
            className={active === "daily-report" ? activeClass : linkClass}
            aria-current={active === "daily-report" ? "page" : undefined}
          >
            Daily report
          </Link>
          <Link
            href="/admin/open-play-report#todays-check-ins"
            className={linkClass}
          >
            Today&apos;s check-ins
          </Link>
          <Link
            href="/admin/open-play-corrections#corrections"
            className={active === "corrections" ? activeClass : linkClass}
            aria-current={active === "corrections" ? "page" : undefined}
          >
            Corrections
          </Link>
        </>
      ) : null}
    </nav>
  );
}
