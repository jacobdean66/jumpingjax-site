import assert from "node:assert/strict";
import test from "node:test";

const opsPath = "./inventory-ops" + ".ts";
const inventoryPath = "./inventory" + ".ts";

const ops = await import(opsPath);
const inventory = await import(inventoryPath);

const {
  blowerTotalsByHorsepower,
  catalogSyncOmitsOperationalFields,
  defaultCleaningSupply,
  formatBlowerSummary,
  formatCleaningSupplyLabel,
  formatCordSummary,
  formatDimensionsSummary,
  normalizeBlowerRequirements,
  parseInventoryOperationalFields,
  parsePositiveDimension,
  required100FootCordCount,
  required50FootCordCount,
  resolveCleaningSupply,
  totalBlowerCount,
  validateInventoryOperationalInput,
} = ops;

const { buildCatalogSyncRows } = inventory;

test("empty blower requirements are allowed", () => {
  assert.deepEqual(normalizeBlowerRequirements([]), []);
  assert.equal(totalBlowerCount([]), 0);
  assert.equal(formatBlowerSummary([]), "No blowers");
});

test("one 1 HP blower", () => {
  const rows = normalizeBlowerRequirements([{ horsepower: "1", quantity: 1 }]);
  assert.deepEqual(rows, [{ horsepower: "1", quantity: 1 }]);
  assert.equal(totalBlowerCount(rows), 1);
});

test("one 1.5 HP blower", () => {
  const rows = normalizeBlowerRequirements([{ horsepower: "1.5", quantity: 1 }]);
  assert.deepEqual(rows, [{ horsepower: "1.5", quantity: 1 }]);
});

test("one 2 HP blower", () => {
  const rows = normalizeBlowerRequirements([{ horsepower: "2", quantity: 1 }]);
  assert.deepEqual(rows, [{ horsepower: "2", quantity: 1 }]);
});

test("one 3 HP blower", () => {
  const rows = normalizeBlowerRequirements([{ horsepower: "3", quantity: 1 }]);
  assert.deepEqual(rows, [{ horsepower: "3", quantity: 1 }]);
});

test("multiple blower horsepower combinations", () => {
  const rows = normalizeBlowerRequirements([
    { horsepower: "1.5", quantity: 1 },
    { horsepower: "2", quantity: 1 },
  ]);
  assert.deepEqual(rows, [
    { horsepower: "1.5", quantity: 1 },
    { horsepower: "2", quantity: 1 },
  ]);
  assert.equal(totalBlowerCount(rows), 2);
  assert.deepEqual(blowerTotalsByHorsepower(rows), {
    "1": 0,
    "1.5": 1,
    "2": 1,
    "3": 0,
  });
});

test("duplicate horsepower rows are combined by default", () => {
  const rows = normalizeBlowerRequirements([
    { horsepower: "1.5", quantity: 1 },
    { horsepower: "1.5", quantity: 2 },
  ]);
  assert.deepEqual(rows, [{ horsepower: "1.5", quantity: 3 }]);
});

test("duplicate horsepower rows can be rejected", () => {
  assert.throws(
    () =>
      normalizeBlowerRequirements(
        [
          { horsepower: "2", quantity: 1 },
          { horsepower: "2", quantity: 1 },
        ],
        { combineDuplicates: false },
      ),
    /Duplicate blower horsepower/,
  );
});

test("invalid negative blower quantities are rejected", () => {
  assert.throws(
    () => normalizeBlowerRequirements([{ horsepower: "1", quantity: -1 }]),
    /nonnegative whole number/,
  );
});

test("cord counts match total blower quantity", () => {
  const rows = [
    { horsepower: "1.5" as const, quantity: 1 },
    { horsepower: "2" as const, quantity: 1 },
  ];
  assert.equal(required100FootCordCount(rows), 2);
  assert.equal(required50FootCordCount(rows), 2);
  assert.equal(
    formatCordSummary(rows),
    "2 total blowers\n2 × 100-foot cords\n2 × 50-foot cords",
  );
});

test("empty tarp requirement is allowed", () => {
  const payload = validateInventoryOperationalInput({
    blowerRequirements: [],
    tarpRequirement: "   ",
    cleaningSupply: "disinfectant",
    lengthFt: "",
    widthFt: "",
    heightFt: "",
    dimensionUnit: "ft",
    dimensionSourceText: "",
    dimensionSourceUrl: "",
    dimensionManufacturer: "",
    dimensionConfidence: "",
    dimensionResearchNotes: "",
  });
  assert.equal(payload.tarp_requirement, "");
});

test("tarp text is preserved exactly after trim", () => {
  const text = "One 20' × 30' tarp";
  const payload = validateInventoryOperationalInput({
    blowerRequirements: [],
    tarpRequirement: `  ${text}  `,
    cleaningSupply: "slide-spray",
    lengthFt: null,
    widthFt: null,
    heightFt: null,
    dimensionUnit: "ft",
    dimensionSourceText: "",
    dimensionSourceUrl: "",
    dimensionManufacturer: "",
    dimensionConfidence: null,
    dimensionResearchNotes: "",
  });
  assert.equal(payload.tarp_requirement, text);
});

test("slide category cleaning default", () => {
  assert.equal(defaultCleaningSupply("slides"), "slide-spray");
});

test("water-slide cleaning default", () => {
  assert.equal(defaultCleaningSupply("water-slides"), "slide-spray");
});

test("combo cleaning default", () => {
  assert.equal(defaultCleaningSupply("combos"), "slide-spray");
});

test("other inflatable cleaning default", () => {
  assert.equal(defaultCleaningSupply("bounce-houses"), "disinfectant");
  assert.equal(defaultCleaningSupply("obstacle-courses"), "disinfectant");
});

test("explicit cleaning override is preserved", () => {
  const resolved = resolveCleaningSupply({
    categoryId: "slides",
    cleaningSupply: "disinfectant",
  });
  assert.deepEqual(resolved, {
    cleaningSupply: "disinfectant",
    explicit: true,
  });
});

test("unknown dimensions stay null and never become zero", () => {
  assert.equal(parsePositiveDimension(0), null);
  assert.equal(parsePositiveDimension("0"), null);
  assert.equal(parsePositiveDimension(""), null);
  assert.equal(parsePositiveDimension(null), null);
  const dims = parseInventoryOperationalFields({
    category_id: "bounce-houses",
  }).dimensions;
  assert.equal(dims.lengthFt, null);
  assert.equal(dims.widthFt, null);
  assert.equal(dims.heightFt, null);
  assert.equal(formatDimensionsSummary(dims), "Dimensions unknown");
});

test("valid dimensions and research metadata are preserved", () => {
  const payload = validateInventoryOperationalInput({
    blowerRequirements: [{ horsepower: "1.5", quantity: 1 }],
    tarpRequirement: "No tarp",
    cleaningSupply: "disinfectant",
    lengthFt: 15,
    widthFt: 15,
    heightFt: 14,
    dimensionUnit: "ft",
    dimensionSourceText: "15L x 15W x 14H",
    dimensionSourceUrl: "https://example.com/spec",
    dimensionManufacturer: "Acme Inflatable",
    dimensionConfidence: "verified",
    dimensionResearchNotes: "Measured on site",
  });

  assert.equal(payload.length_ft, 15);
  assert.equal(payload.width_ft, 15);
  assert.equal(payload.height_ft, 14);
  assert.equal(payload.dimension_source_text, "15L x 15W x 14H");
  assert.equal(payload.dimension_source_url, "https://example.com/spec");
  assert.equal(payload.dimension_manufacturer, "Acme Inflatable");
  assert.equal(payload.dimension_confidence, "verified");
  assert.equal(payload.dimension_research_notes, "Measured on site");
  assert.equal(
    formatDimensionsSummary({
      lengthFt: 15,
      widthFt: 15,
      heightFt: 14,
      unit: "ft",
      sourceText: "",
      sourceUrl: "",
      manufacturer: "",
      confidence: "verified",
      researchNotes: "",
    }),
    "15 × 15 × 14 ft",
  );
});

test("save/load round trip through parse and validate", () => {
  const saved = validateInventoryOperationalInput({
    blowerRequirements: [
      { horsepower: "1", quantity: 1 },
      { horsepower: "3", quantity: 2 },
    ],
    tarpRequirement: "Two 20' × 20' tarps",
    cleaningSupply: "slide-spray",
    lengthFt: "22",
    widthFt: "12",
    heightFt: "",
    dimensionUnit: "ft",
    dimensionSourceText: "22 x 12",
    dimensionSourceUrl: "",
    dimensionManufacturer: "Vendor",
    dimensionConfidence: "medium",
    dimensionResearchNotes: "Partial height unknown",
  });

  const loaded = parseInventoryOperationalFields({
    category_id: "water-slides",
    ...saved,
  });

  assert.deepEqual(loaded.blowerRequirements, [
    { horsepower: "1", quantity: 1 },
    { horsepower: "3", quantity: 2 },
  ]);
  assert.equal(loaded.tarpRequirement, "Two 20' × 20' tarps");
  assert.equal(loaded.cleaningSupply, "slide-spray");
  assert.equal(loaded.cleaningSupplyExplicit, true);
  assert.equal(loaded.dimensions.lengthFt, 22);
  assert.equal(loaded.dimensions.widthFt, 12);
  assert.equal(loaded.dimensions.heightFt, null);
  assert.equal(loaded.dimensions.confidence, "medium");
  assert.equal(formatCleaningSupplyLabel(loaded.cleaningSupply), "Slide spray");
  assert.equal(formatBlowerSummary(loaded.blowerRequirements), "1 × 1 HP, 2 × 3 HP");
});

test("catalog sync payload omits owner operational fields", () => {
  const rows = buildCatalogSyncRows();
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(catalogSyncOmitsOperationalFields(row), true);
    assert.equal("blower_requirements" in row, false);
    assert.equal("tarp_requirement" in row, false);
    assert.equal("cleaning_supply" in row, false);
    assert.equal("length_ft" in row, false);
  }
});

test("legacy inventory records without ops columns still load", () => {
  const loaded = parseInventoryOperationalFields({
    category_id: "combos",
    blower_requirements: null,
    tarp_requirement: null,
    cleaning_supply: null,
    length_ft: null,
    width_ft: null,
    height_ft: null,
  });
  assert.deepEqual(loaded.blowerRequirements, []);
  assert.equal(loaded.tarpRequirement, "");
  assert.equal(loaded.cleaningSupply, "slide-spray");
  assert.equal(loaded.cleaningSupplyExplicit, false);
  assert.equal(loaded.dimensions.lengthFt, null);
});
