import { CATEGORY_COPY, CATEGORY_IDS, RENTALS, type RentalCategoryId } from "@/data/rentals";
import {
  catalogSyncOmitsOperationalFields,
  parseInventoryOperationalFields,
  validateInventoryOperationalInput,
  type BlowerRequirement,
  type CleaningSupply,
  type DimensionConfidence,
  type DimensionUnit,
  type InventoryDimensions,
  type InventoryOpsDbPayload,
} from "@/lib/admin/inventory-ops";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const ROUTE_KIND_LABELS = {
  standard: "Standard inflatable",
  "big-slide": "Big slide",
  accessory: "Accessory",
  foam: "Foam party",
  "yard-game": "Yard game",
} as const;

export type RouteKind = keyof typeof ROUTE_KIND_LABELS;

export type AdminInventoryItem = {
  id: string;
  slug: string;
  categoryId: RentalCategoryId;
  categoryLabel: string;
  title: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  imageSrc: string;
  imageAlt: string;
  ageRecommendation: string;
  setupRequirements: string[];
  routeKind: RouteKind;
  estimatedSetupMinutes: number;
  isActive: boolean;
  publicVisible: boolean;
  source: string;
  updatedAt: string | null;
  blowerRequirements: BlowerRequirement[];
  tarpRequirement: string;
  cleaningSupply: CleaningSupply;
  cleaningSupplyExplicit: boolean;
  dimensions: InventoryDimensions;
};

type InventoryRow = {
  id: string;
  slug: string;
  category_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  starting_price: number | string | null;
  image_src: string | null;
  image_alt: string | null;
  age_recommendation: string | null;
  setup_requirements: string[] | null;
  route_kind: string | null;
  estimated_setup_minutes: number | null;
  is_active: boolean | null;
  public_visible: boolean | null;
  source: string | null;
  updated_at: string | null;
  blower_requirements?: unknown;
  tarp_requirement?: string | null;
  cleaning_supply?: string | null;
  length_ft?: number | string | null;
  width_ft?: number | string | null;
  height_ft?: number | string | null;
  dimension_unit?: string | null;
  dimension_source_text?: string | null;
  dimension_source_url?: string | null;
  dimension_manufacturer?: string | null;
  dimension_confidence?: string | null;
  dimension_research_notes?: string | null;
};

export type SaveInventoryInput = {
  id?: string;
  slug: string;
  categoryId: string;
  title: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  imageSrc: string;
  imageAlt: string;
  ageRecommendation: string;
  setupRequirements: string[];
  routeKind: string;
  estimatedSetupMinutes: number;
  isActive: boolean;
  publicVisible: boolean;
  blowerRequirements: BlowerRequirement[];
  tarpRequirement: string;
  cleaningSupply: CleaningSupply;
  lengthFt: number | null;
  widthFt: number | null;
  heightFt: number | null;
  dimensionUnit: DimensionUnit;
  dimensionSourceText: string;
  dimensionSourceUrl: string;
  dimensionManufacturer: string;
  dimensionConfidence: DimensionConfidence | null;
  dimensionResearchNotes: string;
};

const INVENTORY_SELECT_COLUMNS = [
  "id",
  "slug",
  "category_id",
  "title",
  "short_description",
  "description",
  "starting_price",
  "image_src",
  "image_alt",
  "age_recommendation",
  "setup_requirements",
  "route_kind",
  "estimated_setup_minutes",
  "is_active",
  "public_visible",
  "source",
  "updated_at",
  "blower_requirements",
  "tarp_requirement",
  "cleaning_supply",
  "length_ft",
  "width_ft",
  "height_ft",
  "dimension_unit",
  "dimension_source_text",
  "dimension_source_url",
  "dimension_manufacturer",
  "dimension_confidence",
  "dimension_research_notes",
].join(", ");

const INVENTORY_SELECT_COLUMNS_LEGACY = [
  "id",
  "slug",
  "category_id",
  "title",
  "short_description",
  "description",
  "starting_price",
  "image_src",
  "image_alt",
  "age_recommendation",
  "setup_requirements",
  "route_kind",
  "estimated_setup_minutes",
  "is_active",
  "public_visible",
  "source",
  "updated_at",
].join(", ");

function isMissingOpsColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("blower_requirements") ||
    lower.includes("tarp_requirement") ||
    lower.includes("cleaning_supply") ||
    lower.includes("length_ft") ||
    lower.includes("dimension_unit") ||
    lower.includes("dimension_source_text") ||
    lower.includes("dimension_confidence") ||
    lower.includes("does not exist") ||
    lower.includes("could not find")
  );
}

function isCategoryId(value: string): value is RentalCategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

function isRouteKind(value: string | null | undefined): value is RouteKind {
  return Boolean(value && value in ROUTE_KIND_LABELS);
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeInventorySlug(value: string, title: string): string {
  return slugify(value) || slugify(title);
}

function rowToInventoryItem(row: InventoryRow): AdminInventoryItem {
  const categoryId = isCategoryId(row.category_id)
    ? row.category_id
    : "bounce-houses";
  const ops = parseInventoryOperationalFields(row);
  return {
    id: row.id,
    slug: row.slug,
    categoryId,
    categoryLabel: CATEGORY_COPY[categoryId].title,
    title: row.title,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    startingPrice: numberValue(row.starting_price),
    imageSrc: row.image_src ?? "",
    imageAlt: row.image_alt ?? row.title,
    ageRecommendation: row.age_recommendation ?? "",
    setupRequirements: row.setup_requirements ?? [],
    routeKind: isRouteKind(row.route_kind) ? row.route_kind : "standard",
    estimatedSetupMinutes: row.estimated_setup_minutes ?? 45,
    isActive: row.is_active !== false,
    publicVisible: row.public_visible === true,
    source: row.source ?? "admin",
    updatedAt: row.updated_at,
    blowerRequirements: ops.blowerRequirements,
    tarpRequirement: ops.tarpRequirement,
    cleaningSupply: ops.cleaningSupply,
    cleaningSupplyExplicit: ops.cleaningSupplyExplicit,
    dimensions: ops.dimensions,
  };
}

function routeKindForCategory(categoryId: RentalCategoryId, title: string): RouteKind {
  const lowerTitle = title.toLowerCase();
  if (categoryId === "foam-parties") return "foam";
  if (categoryId === "accessories") return "accessory";
  if (categoryId === "yard-games" || categoryId === "inflatable-games") {
    return "yard-game";
  }
  if (categoryId === "slides" || categoryId === "water-slides") {
    return lowerTitle.includes("22") || lowerTitle.includes("24") || lowerTitle.includes("30")
      ? "big-slide"
      : "standard";
  }
  return "standard";
}

function setupMinutesForRouteKind(routeKind: RouteKind): number {
  if (routeKind === "big-slide") return 60;
  if (routeKind === "accessory" || routeKind === "yard-game") return 20;
  if (routeKind === "foam") return 45;
  return 45;
}

function operationalPayloadFromInput(
  input: SaveInventoryInput,
): InventoryOpsDbPayload {
  return validateInventoryOperationalInput({
    blowerRequirements: input.blowerRequirements,
    tarpRequirement: input.tarpRequirement,
    cleaningSupply: input.cleaningSupply,
    lengthFt: input.lengthFt,
    widthFt: input.widthFt,
    heightFt: input.heightFt,
    dimensionUnit: input.dimensionUnit,
    dimensionSourceText: input.dimensionSourceText,
    dimensionSourceUrl: input.dimensionSourceUrl,
    dimensionManufacturer: input.dimensionManufacturer,
    dimensionConfidence: input.dimensionConfidence,
    dimensionResearchNotes: input.dimensionResearchNotes,
  });
}

/** Builds the catalog-only upsert payload used by website sync. */
export function buildCatalogSyncRows(): Record<string, unknown>[] {
  return RENTALS.map((rental) => {
    const routeKind = routeKindForCategory(rental.categoryId, rental.title);
    const row: Record<string, unknown> = {
      slug: rental.slug,
      category_id: rental.categoryId,
      title: rental.title,
      short_description: rental.shortDescription,
      description: rental.description,
      starting_price: rental.startingPrice,
      image_src: rental.imageSrc,
      image_alt: rental.imageAlt,
      age_recommendation: rental.ageRecommendation,
      setup_requirements: rental.setupRequirements,
      route_kind: routeKind,
      estimated_setup_minutes: setupMinutesForRouteKind(routeKind),
      is_active: true,
      public_visible: true,
      source: "code-sync",
    };
    if (!catalogSyncOmitsOperationalFields(row)) {
      throw new Error("Catalog sync payload must omit operational inventory fields.");
    }
    return row;
  });
}

export async function loadAdminInventoryItems(): Promise<AdminInventoryItem[]> {
  const supabase = createServiceRoleClient();
  const primary = await supabase
    .from("rental_inventory_items")
    .select(INVENTORY_SELECT_COLUMNS)
    .order("category_id", { ascending: true })
    .order("title", { ascending: true });

  if (!primary.error) {
    return ((primary.data ?? []) as unknown as InventoryRow[]).map(
      rowToInventoryItem,
    );
  }

  if (!isMissingOpsColumnError(primary.error.message)) {
    throw new Error(primary.error.message);
  }

  const legacy = await supabase
    .from("rental_inventory_items")
    .select(INVENTORY_SELECT_COLUMNS_LEGACY)
    .order("category_id", { ascending: true })
    .order("title", { ascending: true });

  if (legacy.error) throw new Error(legacy.error.message);
  return ((legacy.data ?? []) as unknown as InventoryRow[]).map(rowToInventoryItem);
}

export async function syncCurrentRentalInventory(): Promise<number> {
  const supabase = createServiceRoleClient();
  const rows = buildCatalogSyncRows();

  const { error } = await supabase
    .from("rental_inventory_items")
    .upsert(rows, { onConflict: "slug" });

  if (error) throw new Error(error.message);
  return rows.length;
}

export async function saveInventoryItem(
  input: SaveInventoryInput,
): Promise<{ id: string; categoryId: RentalCategoryId; slug: string }> {
  const categoryId = isCategoryId(input.categoryId)
    ? input.categoryId
    : "bounce-houses";
  const routeKind = isRouteKind(input.routeKind) ? input.routeKind : "standard";
  const slug = normalizeInventorySlug(input.slug, input.title);
  const ops = operationalPayloadFromInput(input);

  if (!slug || !input.title.trim()) {
    throw new Error("Item name and slug are required.");
  }

  const row = {
    slug,
    category_id: categoryId,
    title: input.title.trim(),
    short_description: input.shortDescription.trim(),
    description: input.description.trim(),
    starting_price: input.startingPrice,
    image_src: input.imageSrc.trim(),
    image_alt: input.imageAlt.trim() || input.title.trim(),
    age_recommendation: input.ageRecommendation.trim(),
    setup_requirements: input.setupRequirements,
    route_kind: routeKind,
    estimated_setup_minutes: input.estimatedSetupMinutes,
    is_active: input.isActive,
    public_visible: input.publicVisible,
    source: "admin",
    ...ops,
  };

  const supabase = createServiceRoleClient();
  if (input.id) {
    const { error } = await supabase
      .from("rental_inventory_items")
      .update(row)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id, categoryId, slug };
  }

  const { data, error } = await supabase
    .from("rental_inventory_items")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id), categoryId, slug };
}

/**
 * Approve/hide for the public website only.
 * Does not delete the item or remove it from admin inventory.
 */
export async function setInventoryPublicVisibility(input: {
  id: string;
  publicVisible: boolean;
}): Promise<{ id: string; categoryId: RentalCategoryId; slug: string }> {
  const cleanId = input.id.trim();
  if (!cleanId) {
    throw new Error("Inventory item id is required.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("rental_inventory_items")
    .update({
      public_visible: input.publicVisible,
      source: "admin",
    })
    .eq("id", cleanId)
    .select("id, slug, category_id")
    .single();

  if (error) throw new Error(error.message);

  const categoryId = isCategoryId(String(data.category_id))
    ? (data.category_id as RentalCategoryId)
    : "bounce-houses";

  return {
    id: String(data.id),
    categoryId,
    slug: String(data.slug),
  };
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const cleanId = id.trim();
  if (!cleanId) {
    throw new Error("Inventory item id is required.");
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("rental_inventory_items")
    .delete()
    .eq("id", cleanId);

  if (error) throw new Error(error.message);
}
