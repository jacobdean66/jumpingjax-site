import {
  RENTALS,
  isCategoryId,
  type Rental,
  type RentalCategoryId,
  type RentalMedia,
} from "@/data/rentals";
import { normalizeRentalMedia } from "@/lib/admin/inventory-media";
import {
  isSupabaseServiceConfigured,
  createServiceRoleClient,
} from "@/lib/supabase/admin";

type PublicCatalogRow = {
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
  public_visible: boolean | null;
  is_active: boolean | null;
};

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function inventoryRowToRental(row: PublicCatalogRow): Rental | null {
  if (!isCategoryId(row.category_id)) return null;
  const slug = row.slug.trim();
  const title = row.title.trim();
  if (!slug || !title) return null;

  return {
    id: `${row.category_id}/${slug}`,
    slug,
    categoryId: row.category_id,
    title,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    startingPrice: numberValue(row.starting_price),
    imageSrc: row.image_src ?? "",
    imageAlt: row.image_alt ?? title,
    ageRecommendation: row.age_recommendation ?? "",
    setupRequirements: row.setup_requirements ?? [],
  };
}

/**
 * Merge the code catalog with inventory visibility.
 * - public_visible items replace/add to the website catalog
 * - non-public inventory rows are removed from the website catalog
 * - admin inventory itself is never filtered by this helper
 *
 * Safe rollout: if inventory has rows but none are approved yet, keep the
 * static catalog so the public site is not wiped before Sync/Approve.
 */
export function mergeWebsiteRentals(
  staticRentals: readonly Rental[],
  inventoryRows: readonly PublicCatalogRow[],
): Rental[] {
  if (inventoryRows.length === 0) {
    return [...staticRentals];
  }

  const anyApproved = inventoryRows.some(
    (row) => row.public_visible === true && row.is_active !== false,
  );
  if (!anyApproved) {
    return [...staticRentals];
  }

  const bySlug = new Map(staticRentals.map((rental) => [rental.slug, rental]));
  const hiddenSlugs = new Set<string>();

  for (const row of inventoryRows) {
    const slug = row.slug.trim();
    if (!slug) continue;

    const approved =
      row.public_visible === true && row.is_active !== false;
    if (!approved) {
      hiddenSlugs.add(slug);
      continue;
    }

    const rental = inventoryRowToRental(row);
    if (rental) {
      bySlug.set(slug, rental);
      hiddenSlugs.delete(slug);
    }
  }

  for (const slug of hiddenSlugs) {
    bySlug.delete(slug);
  }

  return [...bySlug.values()].sort((a, b) => {
    if (a.categoryId === b.categoryId) {
      return a.title.localeCompare(b.title);
    }
    return a.categoryId.localeCompare(b.categoryId);
  });
}

async function loadInventoryCatalogRows(): Promise<PublicCatalogRow[]> {
  if (!isSupabaseServiceConfigured()) return [];

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("rental_inventory_items")
      .select(
        [
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
          "public_visible",
          "is_active",
        ].join(", "),
      );

    if (error) {
      console.error("[public-catalog] inventory load failed", error.message);
      return [];
    }

    return (data ?? []) as unknown as PublicCatalogRow[];
  } catch (error) {
    console.error("[public-catalog] inventory load failed", error);
    return [];
  }
}

/** Website-facing rental catalog driven by inventory public approval. */
export async function loadWebsiteRentals(): Promise<Rental[]> {
  const rows = await loadInventoryCatalogRows();
  if (rows.length === 0) return [...RENTALS];
  return mergeWebsiteRentals(RENTALS, rows);
}

export async function loadWebsiteRentalsInCategory(
  categoryId: RentalCategoryId,
): Promise<Rental[]> {
  const rentals = await loadWebsiteRentals();
  return rentals.filter((rental) => rental.categoryId === categoryId);
}

export async function getWebsiteRentalInCategory(
  categoryId: string,
  slug: string,
): Promise<Rental | undefined> {
  if (!isCategoryId(categoryId)) return undefined;
  const rentals = await loadWebsiteRentals();
  const rental = rentals.find(
    (rental) => rental.categoryId === categoryId && rental.slug === slug,
  );
  if (!rental) return undefined;
  return { ...rental, media: await loadRentalDetailMedia(rental) };
}

type PublicMediaRow = {
  id: string;
  media_type: "image" | "video";
  url: string;
  alt_text: string | null;
  caption: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  poster_url: string | null;
};

async function loadRentalDetailMedia(rental: Rental): Promise<RentalMedia[]> {
  const fallback = {
    rentalId: rental.id,
    imageSrc: rental.imageSrc,
    imageAlt: rental.imageAlt,
  };
  if (!isSupabaseServiceConfigured()) return normalizeRentalMedia([], fallback);
  try {
    const supabase = createServiceRoleClient();
    const { data: item, error: itemError } = await supabase
      .from("rental_inventory_items")
      .select("id")
      .eq("slug", rental.slug)
      .maybeSingle();
    if (itemError || !item?.id) return normalizeRentalMedia([], fallback);
    const { data, error } = await supabase
      .from("rental_inventory_media")
      .select("id, media_type, url, alt_text, caption, sort_order, is_cover, poster_url")
      .eq("rental_id", item.id)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[public-catalog] rental media load failed", error.message);
      return normalizeRentalMedia([], fallback);
    }
    const media = ((data ?? []) as unknown as PublicMediaRow[]).map((row) => ({
      id: row.id,
      mediaType: row.media_type,
      url: row.url,
      altText: row.alt_text ?? "",
      caption: row.caption ?? "",
      sortOrder: row.sort_order ?? 0,
      isCover: row.is_cover === true,
      posterUrl: row.poster_url,
    }));
    return normalizeRentalMedia(media, fallback);
  } catch (error) {
    console.error("[public-catalog] rental media load failed", error);
    return normalizeRentalMedia([], fallback);
  }
}

export async function getWebsiteRentalBySlug(
  slug: string,
): Promise<Rental | undefined> {
  const clean = slug.trim();
  if (!clean) return undefined;
  const rentals = await loadWebsiteRentals();
  return rentals.find((rental) => rental.slug === clean);
}
