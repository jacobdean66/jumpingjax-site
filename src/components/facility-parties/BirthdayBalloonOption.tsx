import { useId } from "react";
import {
  BIRTHDAY_BALLOON_AGE_ERROR,
  BIRTHDAY_BALLOON_DIGIT_PRICE,
  getBirthdayBalloonDigits,
} from "../../lib/facility-parties/addons";

export function BirthdayBalloonOption({ age, selected, onSelectedChange }: {
  age: string;
  selected: boolean;
  onSelectedChange: (value: boolean) => void;
}) {
  const priceId = useId();
  const balloonDigits = getBirthdayBalloonDigits(age);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#071326]/40 px-3 py-3">
      <input
        type="checkbox"
        checked={selected}
        aria-describedby={priceId}
        onChange={(e) => onSelectedChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
      />
      <span className="text-sm text-slate-200">
        <span className="font-semibold text-white">
          Custom Birthday Balloons
        </span>
        <span id={priceId} aria-live="polite" className="mt-0.5 block text-slate-400">
          ${BIRTHDAY_BALLOON_DIGIT_PRICE} per digit
          {selected && (
            <span className="block">
              {balloonDigits
                ? `Number ${balloonDigits}: ${balloonDigits.length} ${balloonDigits.length === 1 ? "balloon" : "balloons"} · $${balloonDigits.length * BIRTHDAY_BALLOON_DIGIT_PRICE}`
                : BIRTHDAY_BALLOON_AGE_ERROR}
            </span>
          )}
        </span>
      </span>
    </label>
  );
}
