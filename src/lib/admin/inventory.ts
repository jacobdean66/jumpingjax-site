import { CATEGORY_COPY, CATEGORY_IDS, RENTALS, type RentalCategoryId } from "@/data/rentals";
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
};

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

export async function loadAdminInventoryItems(): Promise<AdminInventoryItem[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("rental_inventory_items")
    .select(
      "id, slug, category_id, title, short_description, description, starting_price, image_src, image_alt, age_recommendation, setup_requirements, route_kind, estimated_setup_minutes, is_active, public_visible, source, updated_at",
    )
    .order("category_id", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as InventoryRow[]).map(rowToInventoryItem);
}

export async function syncCurrentRentalInventory(): Promise<number> {
  const supabase = createServiceRoleClient();
  const rows = RENTALS.map((rental) => {
    const routeKind = routeKindForCategory(rental.categoryId, rental.title);
    return {
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
  });

  const { error } = await supabase
    .from("rental_inventory_items")
    .upsert(rows, { onConflict: "slug" });

  if (error) throw new Error(error.message);
  return rows.length;
}

export async function saveInventoryItem(input: SaveInventoryInput): Promise<void> {
  const categoryId = isCategoryId(input.categoryId)
    ? input.categoryId
    : "bounce-houses";
  const routeKind = isRouteKind(input.routeKind) ? input.routeKind : "standard";
  const slug = normalizeInventorySlug(input.slug, input.title);

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
  };

  const supabase = createServiceRoleClient();
  const query = input.id
    ? supabase.from("rental_inventory_items").update(row).eq("id", input.id)
    : supabase.from("rental_inventory_items").insert(row);

  const { error } = await query;
  if (error) throw new Error(error.message);
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
