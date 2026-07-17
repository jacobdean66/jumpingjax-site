"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDateRangeToSelection,
  datesForPreset,
  datesToSearchParams,
  formatLongDate,
  normalizeSelectedDates,
  parseDatesFromSearchParams,
  removeDateFromSelection,
  toggleDateInSelection,
  type DatePresetId,
} from "@/lib/admin/delivery-planner-dates";

const PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-weekend", label: "This weekend" },
  { id: "next-weekend", label: "Next weekend" },
  { id: "clear", label: "Clear dates" },
];

export function DeliveryDateSelector({
  initialDates,
}: {
  initialDates: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useMemo(() => {
    const fromUrl = parseDatesFromSearchParams({
      date: searchParams.get("date"),
      dates: searchParams.get("dates"),
    });
    return fromUrl.length > 0 ? fromUrl : normalizeSelectedDates(initialDates);
  }, [searchParams, initialDates]);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [addDate, setAddDate] = useState("");

  function navigate(nextDates: string[]) {
    const normalized = normalizeSelectedDates(nextDates);
    const params = datesToSearchParams(normalized, {
      work: searchParams.get("work"),
      truck: searchParams.get("truck"),
      load: searchParams.get("load"),
      status: searchParams.get("status"),
    });
    router.replace(`/admin/deliveries?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Planning window
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {selected.length === 1
              ? formatLongDate(selected[0]!)
              : `${selected.length} dates selected`}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => navigate(datesForPreset(preset.id))}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-900 hover:bg-sky-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {selected.map((date) => (
          <button
            key={date}
            type="button"
            onClick={() => navigate(removeDateFromSelection(selected, date))}
            className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
            title="Remove date"
          >
            {formatLongDate(date)} ×
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Add date
          <div className="flex gap-2">
            <input
              type="date"
              value={addDate}
              onChange={(event) => setAddDate(event.target.value)}
              className="w-full rounded-xl border border-sky-200 px-3 py-2 text-slate-950"
            />
            <button
              type="button"
              onClick={() => {
                if (!addDate) return;
                navigate(toggleDateInSelection(selected, addDate));
                setAddDate("");
              }}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700"
            >
              Add
            </button>
          </div>
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
          Add date range
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className="rounded-xl border border-sky-200 px-3 py-2 text-slate-950"
            />
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="rounded-xl border border-sky-200 px-3 py-2 text-slate-950"
            />
            <button
              type="button"
              onClick={() => {
                if (!rangeStart || !rangeEnd) return;
                navigate(addDateRangeToSelection(selected, rangeStart, rangeEnd));
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Add range
            </button>
          </div>
        </label>
      </div>
    </section>
  );
}
