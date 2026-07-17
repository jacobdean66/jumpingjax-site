import { ChevronDown } from "lucide-react";
import styles from "./RentalAvailabilityScrollCue.module.css";

export function RentalAvailabilityScrollCue() {
  return (
    <a
      href="#book-rental"
      className="mt-3 inline-flex max-w-prose items-start gap-1.5 text-left text-xs leading-snug text-slate-400/85 transition-colors hover:text-cyan-200/75 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071326] sm:mt-3.5 sm:text-[0.8125rem]"
    >
      <span>
        Scroll down to check availability before you enter your event details.
      </span>
      <ChevronDown
        className={`${styles.chevron} mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70`}
        aria-hidden="true"
        strokeWidth={2}
      />
    </a>
  );
}
