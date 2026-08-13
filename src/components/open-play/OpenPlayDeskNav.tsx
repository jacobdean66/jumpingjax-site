import Link from "next/link";

type DeskSurface = "check-in" | "daily-report" | "whos-here";

type Props = {
  active: DeskSurface;
  /** Owner-only daily report is shown when true. */
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
      <Link
        href="/admin/whos-here"
        className={active === "whos-here" ? activeClass : linkClass}
        aria-current={active === "whos-here" ? "page" : undefined}
      >
        Who&apos;s here
      </Link>
      {showOwnerTools ? (
        <Link
          href="/admin/open-play-report#daily-report"
          className={active === "daily-report" ? activeClass : linkClass}
          aria-current={active === "daily-report" ? "page" : undefined}
        >
          Daily report
        </Link>
      ) : null}
    </nav>
  );
}
