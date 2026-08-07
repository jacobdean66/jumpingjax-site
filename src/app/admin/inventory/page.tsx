import Link from "next/link";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
  type RentalCategoryId,
} from "@/data/rentals";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadAdminInventoryItems,
  type AdminInventoryItem,
} from "@/lib/admin/inventory";
import { loadInventoryRentalCounts } from "@/lib/admin/inventory-counts";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  StatTile,
} from "../_components";
import { InventoryItemForm } from "./InventoryItemForm";
import { InventoryList } from "./InventoryList";

export const dynamic = "force-dynamic";

type VisibilityFilter = "all" | "review" | "public";

type Props = {
  searchParams?: Promise<{
    token?: string;
    item?: string;
    category?: string;
    visibility?: string;
    message?: string;
    error?: string;
  }>;
};

function selectedItem(
  items: AdminInventoryItem[],
  itemId: string | undefined,
): AdminInventoryItem | undefined {
  if (!itemId) return undefined;
  return items.find((item) => item.id === itemId || item.slug === itemId);
}

function isCategoryId(value: string | undefined): value is RentalCategoryId {
  return Boolean(value && (CATEGORY_IDS as readonly string[]).includes(value));
}

function parseVisibilityFilter(value: string | undefined): VisibilityFilter {
  if (value === "review" || value === "public") return value;
  return "all";
}

function inventoryHref(
  token: string,
  options?: {
    categoryId?: RentalCategoryId;
    visibility?: VisibilityFilter;
  },
) {
  const params = new URLSearchParams({ token });
  if (options?.categoryId) params.set("category", options.categoryId);
  if (options?.visibility && options.visibility !== "all") {
    params.set("visibility", options.visibility);
  }
  return `/admin/inventory?${params.toString()}`;
}

export default async function AdminInventoryPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return <AdminAuthError reason={auth.reason} />;
  }

  let items: AdminInventoryItem[] = [];
  let loadError: string | null = null;
  let rentalCounts = new Map<
    string,
    { slug: string; pastRentals: number; futureBookings: number }
  >();
  try {
    items = await loadAdminInventoryItems();
    rentalCounts = await loadInventoryRentalCounts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Inventory could not load";
  }

  const item = selectedItem(items, resolved?.item);
  const activeCategory = isCategoryId(resolved?.category)
    ? resolved.category
    : undefined;
  const visibilityFilter = parseVisibilityFilter(resolved?.visibility);
  const needsReview = (row: AdminInventoryItem) =>
    row.isActive && !row.publicVisible;
  const categoryScopedItems = activeCategory
    ? items.filter((row) => row.categoryId === activeCategory)
    : items;
  const filteredItems =
    visibilityFilter === "review"
      ? categoryScopedItems.filter(needsReview)
      : visibilityFilter === "public"
        ? categoryScopedItems.filter((row) => row.publicVisible)
        : categoryScopedItems;
  const reviewItems = filteredItems.filter(needsReview);
  const categoryCounts = CATEGORY_IDS.reduce<Record<string, number>>(
    (counts, categoryId) => ({
      ...counts,
      [categoryId]: items.filter((row) => row.categoryId === categoryId).length,
    }),
    {},
  );
  const activeCount = items.filter((row) => row.isActive).length;
  const publicCount = items.filter((row) => row.publicVisible).length;
  const reviewCount = items.filter(needsReview).length;
  const listTitle =
    visibilityFilter === "review"
      ? "Needs review"
      : visibilityFilter === "public"
        ? "On website"
        : activeCategory
          ? CATEGORY_COPY[activeCategory].title
          : `${items.length} items`;
  const rentalCountsBySlug = Object.fromEntries(
    [...rentalCounts.entries()].map(([slug, counts]) => [
      slug,
      {
        pastRentals: counts.pastRentals,
        futureBookings: counts.futureBookings,
      },
    ]),
  );
  const listItems = filteredItems.map((row) => ({
    id: row.id,
    slug: row.slug,
    categoryLabel: row.categoryLabel,
    title: row.title,
    startingPrice: row.startingPrice,
    routeKind: row.routeKind,
    isActive: row.isActive,
    publicVisible: row.publicVisible,
  }));

  return (
    <AdminShell>
      <AdminHeader eyebrow="Inventory Admin" title="Rental Inventory" />
      <AdminNav token={token} role={auth.role} active="inventory" />

      {resolved?.message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
          {resolved.message}
        </div>
      ) : null}
      {resolved?.error || loadError ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-950">
          {resolved?.error ?? loadError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatTile
          label="Inventory items"
          value={items.length}
          href={inventoryHref(token)}
        />
        <StatTile label="Active for staff" value={activeCount} />
        <StatTile
          label="Needs review"
          value={reviewCount}
          href={inventoryHref(token, {
            categoryId: activeCategory,
            visibility: "review",
          })}
        />
        <StatTile
          label="On website"
          value={publicCount}
          href={inventoryHref(token, {
            categoryId: activeCategory,
            visibility: "public",
          })}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        Click Needs review to open items waiting for website approval. Approving
        keeps them in this inventory list; review only controls public website
        visibility.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <form action="/api/admin/inventory/sync" method="post">
          <input type="hidden" name="token" value={token} />
          <button className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 hover:bg-amber-200">
            Sync Current Website Catalog
          </button>
        </form>
        {reviewItems.length > 0 ? (
          <form action="/api/admin/inventory/approve-review" method="post">
            <input type="hidden" name="token" value={token} />
            {activeCategory ? (
              <input type="hidden" name="category" value={activeCategory} />
            ) : null}
            {visibilityFilter !== "all" ? (
              <input type="hidden" name="visibility" value={visibilityFilter} />
            ) : null}
            {reviewItems.map((row) => (
              <input key={row.id} type="hidden" name="ids" value={row.id} />
            ))}
            <button className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-white hover:bg-cyan-600">
              Approve all for website ({reviewItems.length})
            </button>
          </form>
        ) : null}
        <Link
          href={inventoryHref(token)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Add New Item
        </Link>
      </div>
      <p className="mt-3 max-w-3xl text-xs font-semibold leading-relaxed text-slate-500">
        Sync once to mark existing catalog units as already on the website. After
        that, open Needs review and approve items for the website. Approving never
        deletes inventory rows.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Click a category
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {activeCategory ? CATEGORY_COPY[activeCategory].title : "All inventory"}
              {visibilityFilter === "review"
                ? " · Needs review"
                : visibilityFilter === "public"
                  ? " · On website"
                  : ""}
            </h2>
          </div>
          <p className="text-sm font-bold text-slate-500">
            Showing {filteredItems.length} of {items.length}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={inventoryHref(token, { visibility: visibilityFilter })}
            className={`rounded-xl border p-3 transition hover:border-sky-300 hover:bg-sky-50 ${
              !activeCategory
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-sm font-black">All inventory</p>
            <p className="mt-1 text-2xl font-black">{items.length}</p>
          </Link>
          {CATEGORY_IDS.map((categoryId) => (
            <Link
              key={categoryId}
              href={inventoryHref(token, {
                categoryId,
                visibility: visibilityFilter,
              })}
              className={`rounded-xl border p-3 transition hover:border-sky-300 hover:bg-sky-50 ${
                activeCategory === categoryId
                  ? "border-sky-400 bg-sky-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-sm font-black">{CATEGORY_COPY[categoryId].title}</p>
              <p className="mt-1 text-2xl font-black">
                {categoryCounts[categoryId] ?? 0}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Current Inventory
              </p>
              <h2 className="mt-2 text-2xl font-black">{listTitle}</h2>
            </div>
            <p className="text-xs font-bold text-slate-500">
              On website: {publicCount}
            </p>
          </div>

          <InventoryList
            items={listItems}
            totalItemCount={items.length}
            selectedItemId={item?.id}
            token={token}
            activeCategory={activeCategory}
            visibilityFilter={visibilityFilter}
            rentalCounts={rentalCountsBySlug}
          />
        </section>

        <InventoryItemForm
          token={token}
          item={item}
          cancelHref={inventoryHref(token, {
            categoryId: activeCategory,
            visibility: visibilityFilter,
          })}
        />
      </div>
    </AdminShell>
  );
}
