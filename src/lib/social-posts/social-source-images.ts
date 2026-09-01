import {
  CATEGORY_COPY,
  HOMEPAGE_HERO_ASSET,
  RENTALS,
  type RentalCategoryId,
} from "@/data/rentals";
import { APPROVED_INVITATION_ARTWORK } from "@/lib/facility-parties/invitations/approved-artwork";
import { INVITATION_LIBRARY_THEMES } from "@/lib/facility-parties/invitations/library/themes";

export type SocialSourceImage = {
  label: string;
  url: string;
  category?: string;
  focus?: "rentals" | "facility-parties" | "both";
  /**
   * Product shots may show the exact inflatable only. Lifestyle photos must
   * have been separately approved for the visible people and event context.
   */
  assetKind?: "product" | "lifestyle" | "theme-artwork" | "brand";
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? "";

function publicImageUrl(src: string): string | null {
  const cleaned = src.trim();
  if (!cleaned) return null;

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  if (!cleaned.startsWith("/") || !SITE_URL) {
    return null;
  }

  return `${SITE_URL}${cleaned}`;
}

function categoryLabel(categoryId: RentalCategoryId): string {
  return CATEGORY_COPY[categoryId]?.title ?? categoryId;
}

function uniqueByUrl(images: SocialSourceImage[]): SocialSourceImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

export const SOCIAL_SOURCE_IMAGES: SocialSourceImage[] = uniqueByUrl([
  ...RENTALS.map((rental): SocialSourceImage | null => {
    const url = publicImageUrl(rental.imageSrc);
    if (!url) return null;

    const category = categoryLabel(rental.categoryId);
    return {
      label: `${rental.title} (${category})`,
      url,
      category,
      focus: rental.categoryId === "foam-parties" ? "both" : "rentals",
      assetKind: "product",
    };
  }),
  (() => {
    const url = publicImageUrl(HOMEPAGE_HERO_ASSET.src);
    if (!url) return null;
    return {
      label: "Homepage hero",
      url,
      category: "Homepage",
      focus: "both",
      assetKind: "brand",
    } satisfies SocialSourceImage;
  })(),
  (() => {
    const url = publicImageUrl("/logo.png");
    if (!url) return null;
    return {
      label: "Jumping Jax logo",
      url,
      category: "Brand",
      focus: "both",
      assetKind: "brand",
    } satisfies SocialSourceImage;
  })(),
  ...Object.entries(APPROVED_INVITATION_ARTWORK).map(
    ([theme, src]): SocialSourceImage | null => {
      const url = publicImageUrl(src);
      if (!url) return null;
      return {
        label: `${theme} approved invitation artwork`,
        url,
      category: "Facility invitation themes",
      focus: "facility-parties",
      assetKind: "theme-artwork",
      };
    },
  ),
  ...INVITATION_LIBRARY_THEMES.flatMap((theme) =>
    [...theme.heroes, ...theme.decorations].map(
      (asset): SocialSourceImage | null => {
        const url = publicImageUrl(asset.src);
        if (!url) return null;
        return {
          label: `${theme.label}: ${asset.alt}`,
          url,
          category: "Facility invitation themes",
          focus: "facility-parties",
          assetKind: "theme-artwork",
        };
      },
    ),
  ),
].filter((image): image is SocialSourceImage => Boolean(image)));

