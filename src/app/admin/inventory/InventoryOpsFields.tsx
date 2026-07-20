"use client";

import { useState } from "react";
import {
  BLOWER_HORSEPOWERS,
  CLEANING_SUPPLY_VALUES,
  DIMENSION_CONFIDENCE_VALUES,
  DIMENSION_UNITS,
  formatCleaningSupplyLabel,
  type BlowerHorsepower,
  type BlowerRequirement,
  type CleaningSupply,
  type InventoryDimensions,
} from "@/lib/admin/inventory-ops";

type Props = {
  blowerRequirements: BlowerRequirement[];
  tarpRequirement: string;
  cleaningSupply: CleaningSupply;
  dimensions: InventoryDimensions;
};

function nextBlowerHorsepower(
  existing: BlowerRequirement[],
): BlowerHorsepower {
  const used = new Set(existing.map((row) => row.horsepower));
  return (
    BLOWER_HORSEPOWERS.find((hp) => !used.has(hp)) ?? BLOWER_HORSEPOWERS[0]
  );
}

export function InventoryOpsFields({
  blowerRequirements: initialBlowers,
  tarpRequirement,
  cleaningSupply,
  dimensions,
}: Props) {
  const [blowers, setBlowers] = useState<BlowerRequirement[]>(
    initialBlowers.length > 0
      ? initialBlowers
      : [],
  );

  function updateRow(index: number, patch: Partial<BlowerRequirement>) {
    setBlowers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setBlowers((rows) => [
      ...rows,
      { horsepower: nextBlowerHorsepower(rows), quantity: 1 },
    ]);
  }

  function removeRow(index: number) {
    setBlowers((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
          Operational details
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Blowers, tarps, cleaning supply, and inflated dimensions for this
          inventory item.
        </p>
      </div>

      <input
        type="hidden"
        name="blowerRequirements"
        value={JSON.stringify(blowers)}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-slate-800">Blower requirements</p>
          <button
            type="button"
            onClick={addRow}
            className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-black text-white hover:bg-sky-600"
          >
            Add blower row
          </button>
        </div>
        {blowers.length === 0 ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            No blowers. Use for tents, chairs, generators, and other non-blower
            rentals.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {blowers.map((row, index) => (
              <div
                key={`${row.horsepower}-${index}`}
                className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2"
              >
                <label className="text-xs font-bold text-slate-700">
                  Horsepower
                  <select
                    value={row.horsepower}
                    onChange={(event) =>
                      updateRow(index, {
                        horsepower: event.target.value as BlowerHorsepower,
                      })
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-500"
                  >
                    {BLOWER_HORSEPOWERS.map((hp) => (
                      <option key={hp} value={hp}>
                        {hp} HP
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">
                  Qty
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(index, {
                        quantity: Number(event.target.value),
                      })
                    }
                    className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="block text-sm font-bold text-slate-700">
        Tarp requirement
        <textarea
          name="tarpRequirement"
          rows={2}
          defaultValue={tarpRequirement}
          placeholder="One 20' × 30' tarp"
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
        />
        <span className="mt-1 block text-xs font-semibold text-slate-500">
          Example: One 20&apos; × 30&apos; tarp · Two 20&apos; × 20&apos; tarps ·
          No tarp
        </span>
      </label>

      <label className="block text-sm font-bold text-slate-700">
        Cleaning supply
        <select
          name="cleaningSupply"
          defaultValue={cleaningSupply}
          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
        >
          {CLEANING_SUPPLY_VALUES.map((value) => (
            <option key={value} value={value}>
              {formatCleaningSupplyLabel(value)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-bold text-slate-700">
          Length (ft)
          <input
            name="lengthFt"
            type="number"
            min="0"
            step="any"
            defaultValue={dimensions.lengthFt ?? ""}
            placeholder="Unknown"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Width (ft)
          <input
            name="widthFt"
            type="number"
            min="0"
            step="any"
            defaultValue={dimensions.widthFt ?? ""}
            placeholder="Unknown"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Height (ft)
          <input
            name="heightFt"
            type="number"
            min="0"
            step="any"
            defaultValue={dimensions.heightFt ?? ""}
            placeholder="Unknown"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>
      <p className="text-xs font-semibold text-slate-500">
        Leave blank when unknown. Do not enter 0 for unknown dimensions.
      </p>

      <details className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-800">
          Dimension research details
        </summary>
        <div className="mt-3 grid gap-3">
          <label className="text-sm font-bold text-slate-700">
            Measurement unit
            <select
              name="dimensionUnit"
              defaultValue={dimensions.unit}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            >
              {DIMENSION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Original source dimension text
            <input
              name="dimensionSourceText"
              defaultValue={dimensions.sourceText}
              placeholder="e.g. 15L x 15W x 14H"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Source URL
            <input
              name="dimensionSourceUrl"
              defaultValue={dimensions.sourceUrl}
              placeholder="https://"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Manufacturer or source name
            <input
              name="dimensionManufacturer"
              defaultValue={dimensions.manufacturer}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Match confidence
            <select
              name="dimensionConfidence"
              defaultValue={dimensions.confidence ?? ""}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            >
              <option value="">Not set</option>
              {DIMENSION_CONFIDENCE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Research notes
            <textarea
              name="dimensionResearchNotes"
              rows={3}
              defaultValue={dimensions.researchNotes}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
