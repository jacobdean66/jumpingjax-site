import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultRequiresDisinfectant,
  defaultRequiresSlideSpray,
  emptyInventoryOperationalFields,
  extensionCordsFromBlowers,
  formatDimensions,
  formatEquipmentEntries,
  operationalFieldsFromRow,
  operationalFieldsToRow,
  parseEquipmentEntries,
  parseEquipmentEntriesFromForm,
  resolveSupplyRequirements,
  totalEquipmentQuantity,
} from "./inventory-ops.ts";
import {
  consolidateLoadEquipment,
  equipmentForItem,
} from "./inventory-equipment.ts";
import {
  MAX_TRAILER_INFLATABLES,
  canAssignInflatableToTrailer,
  countTrailerInflatables,
  evaluateTrailerCapacity,
} from "./trailer-capacity.ts";
import { mergeTrailerCapacityOccupancy } from "./trailer-capacity-merge.ts";

describe("inventory-ops supplies", () => {
  it("defaults slide spray for slides and combos", () => {
    assert.equal(defaultRequiresSlideSpray("slides"), true);
    assert.equal(defaultRequiresSlideSpray("water-slides"), true);
    assert.equal(defaultRequiresSlideSpray("combos"), true);
    assert.equal(defaultRequiresSlideSpray("bounce-houses"), false);
  });

  it("defaults disinfectant for other inflatable types", () => {
    assert.equal(defaultRequiresDisinfectant("bounce-houses"), true);
    assert.equal(defaultRequiresDisinfectant("obstacle-courses"), true);
    assert.equal(defaultRequiresDisinfectant("inflatable-games"), true);
    assert.equal(defaultRequiresDisinfectant("combos"), false);
  });

  it("honors explicit overrides and null means category default", () => {
    const overridden = resolveSupplyRequirements({
      categoryId: "bounce-houses",
      requiresSlideSpray: true,
      requiresDisinfectant: false,
    });
    assert.equal(overridden.requiresSlideSpray, true);
    assert.equal(overridden.requiresDisinfectant, false);
    assert.equal(overridden.slideSprayOverridden, true);

    const defaults = resolveSupplyRequirements({
      categoryId: "combos",
      requiresSlideSpray: null,
      requiresDisinfectant: null,
    });
    assert.equal(defaults.requiresSlideSpray, true);
    assert.equal(defaults.requiresDisinfectant, false);
  });
});

describe("inventory-ops equipment parsing", () => {
  it("parses blower and tarp entries and ignores malformed rows", () => {
    const blowers = parseEquipmentEntries([
      { quantity: 2, description: "1.5 HP blower" },
      { quantity: 1, type: "2 HP blower" },
      { quantity: 0, description: "bad" },
      { quantity: 1, description: "" },
      null,
    ]);
    assert.deepEqual(blowers, [
      { quantity: 2, description: "1.5 HP blower" },
      { quantity: 1, description: "2 HP blower" },
    ]);
  });

  it("parses form rows and rejects invalid quantities", () => {
    const entries = parseEquipmentEntriesFromForm(
      ["2", "1"],
      ["1.5 HP blower", "2 HP blower"],
    );
    assert.equal(totalEquipmentQuantity(entries), 3);
    assert.throws(() =>
      parseEquipmentEntriesFromForm(["0"], ["1.5 HP blower"]),
    );
  });

  it("derives extension cords from blower quantity", () => {
    assert.deepEqual(extensionCordsFromBlowers([{ quantity: 1, description: "1.5 HP" }]), {
      cords100ft: 1,
      cords50ft: 1,
    });
    assert.deepEqual(
      extensionCordsFromBlowers([
        { quantity: 2, description: "1.5 HP" },
        { quantity: 1, description: "2 HP" },
      ]),
      { cords100ft: 3, cords50ft: 3 },
    );
  });
});

describe("inventory-ops dimensions and row mapping", () => {
  it("formats dimensions and maps DB rows", () => {
    const fields = operationalFieldsFromRow(
      {
        length_ft: 15,
        width_ft: 15,
        height_ft: 14,
        dimension_units: "ft",
        blowers: [{ quantity: 1, description: "1.5 HP" }],
        tarps: [{ quantity: 1, description: "20 ft × 30 ft" }],
        requires_slide_spray: null,
        requires_disinfectant: null,
      },
      "bounce-houses",
    );
    assert.equal(formatDimensions(fields.dimensions), "15 × 15 × 14 ft");
    assert.equal(formatEquipmentEntries(fields.blowers), "1 × 1.5 HP");
    assert.equal(fields.requiresDisinfectant, true);
    assert.equal(emptyInventoryOperationalFields("slides").requiresSlideSpray, true);
  });
});

describe("load equipment consolidation", () => {
  it("dedupes by taskId and totals cords, spray, and disinfectant", () => {
    const ops = operationalFieldsFromRow(
      {
        blowers: [{ quantity: 2, description: "1.5 HP" }],
        tarps: [{ quantity: 1, description: "15×20" }],
        requires_slide_spray: true,
        requires_disinfectant: false,
      },
      "combos",
    );
    const item = equipmentForItem({
      taskId: "task-1",
      rentalItem: "castle-combo",
      rentalName: "Castle Combo",
      isInflatable: true,
      ops,
    });
    const totals = consolidateLoadEquipment([item, item]);
    assert.equal(totals.inflatableCount, 1);
    assert.equal(totals.blowerCount, 2);
    assert.equal(totals.cords100ft, 2);
    assert.equal(totals.cords50ft, 2);
    assert.equal(totals.slideSprayCount, 1);
    assert.equal(totals.disinfectantCount, 0);
  });
});

describe("supply override persistence", () => {
  it("writes null supply columns when matching category defaults", () => {
    const matching = emptyInventoryOperationalFields("combos");
    matching.slideSprayOverridden = false;
    matching.disinfectantOverridden = false;
    const row = operationalFieldsToRow(matching);
    assert.equal(row.requires_slide_spray, null);
    assert.equal(row.requires_disinfectant, null);

    matching.requiresSlideSpray = false;
    matching.slideSprayOverridden = true;
    const overridden = operationalFieldsToRow(matching);
    assert.equal(overridden.requires_slide_spray, false);
  });
});

describe("trailer capacity merge", () => {
  it("keeps existing DB occupants not included in the patch", () => {
    const merged = mergeTrailerCapacityOccupancy({
      patchAssignments: [
        {
          itemId: "new-1",
          rentalItem: "bounce-a",
          rentalName: "Bounce A",
          workType: "delivery",
          workDate: "2026-07-18",
          truck: "truck-1",
          trailerLoad: 1,
          isInflatable: true,
        },
      ],
      existingAssignments: [
        {
          itemId: "old-1",
          rentalItem: "bounce-b",
          rentalName: "Bounce B",
          workType: "delivery",
          workDate: "2026-07-18",
          truck: "truck-1",
          trailerLoad: 1,
          isInflatable: true,
        },
        {
          itemId: "old-2",
          rentalItem: "chairs",
          rentalName: "Chairs",
          workType: "delivery",
          workDate: "2026-07-18",
          truck: "truck-1",
          trailerLoad: 1,
          isInflatable: false,
        },
      ],
    });
    assert.equal(merged.length, 3);
    assert.equal(countTrailerInflatables(merged), 2);
  });
});

describe("trailer capacity", () => {
  it("uses max four inflatables and ignores accessories", () => {
    assert.equal(MAX_TRAILER_INFLATABLES, 4);
    const items = [
      { rentalItem: "bounce-1", rentalName: "Bounce", isInflatable: true },
      { rentalItem: "bounce-2", rentalName: "Bounce 2", isInflatable: true },
      { rentalItem: "bounce-3", rentalName: "Bounce 3", isInflatable: true },
      { rentalItem: "blower-1", rentalName: "Blower", isInflatable: false },
      { rentalItem: "extension-cord", rentalName: "Cord", isInflatable: false },
    ];
    assert.equal(countTrailerInflatables(items), 3);
    const atLimit = evaluateTrailerCapacity([
      ...items,
      { rentalItem: "bounce-4", rentalName: "Bounce 4", isInflatable: true },
    ]);
    assert.equal(atLimit.inflatableCount, 4);
    assert.equal(atLimit.atCapacity, true);
    assert.equal(atLimit.exceedsCapacity, false);

    const blocked = canAssignInflatableToTrailer({
      currentItems: [
        { rentalItem: "a", rentalName: "A", isInflatable: true },
        { rentalItem: "b", rentalName: "B", isInflatable: true },
        { rentalItem: "c", rentalName: "C", isInflatable: true },
        { rentalItem: "d", rentalName: "D", isInflatable: true },
      ],
      nextItem: { rentalItem: "e", rentalName: "E", isInflatable: true },
    });
    assert.equal(blocked.ok, false);
    assert.match(blocked.result.blockedMessage ?? "", /max 4/);

    const override = canAssignInflatableToTrailer({
      currentItems: blocked.result
        ? [
            { rentalItem: "a", rentalName: "A", isInflatable: true },
            { rentalItem: "b", rentalName: "B", isInflatable: true },
            { rentalItem: "c", rentalName: "C", isInflatable: true },
            { rentalItem: "d", rentalName: "D", isInflatable: true },
          ]
        : [],
      nextItem: { rentalItem: "e", rentalName: "E", isInflatable: true },
      allowOwnerOverride: true,
    });
    assert.equal(override.ok, true);
    assert.equal(override.requiresOverride, true);
  });
});
