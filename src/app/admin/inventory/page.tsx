import Link from "next/link";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
  type RentalCategoryId,
} from "@/data/rentals";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadAdminInventoryItems,
  ROUTE_KIND_LABELS,
  type AdminInventoryItem,
} from "@/lib/admin/inventory";
import {
  emptyInventoryCounts,
  loadInventoryRentalCounts,
} from "@/lib/admin/inventory-counts";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  StatTile,
} from "../_components";
import { InventoryItemForm } from "./InventoryItemForm";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    item?: string;
    category?: string;
    message?: string;
    error?: string;
  }>;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

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

function categoryHref(token: string, categoryId?: RentalCategoryId) {
  const params = new URLSearchParams({ token });
  if (categoryId) params.set("category", categoryId);
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
  const query = `token=${encodeURIComponent(token)}`;
  const activeCategory = isCategoryId(resolved?.category)
    ? resolved.category
    : undefined;
  const filteredItems = activeCategory
    ? items.filter((row) => row.categoryId === activeCategory)
    : items;
  const categoryCounts = CATEGORY_IDS.reduce<Record<string, number>>(
    (counts, categoryId) => ({
      ...counts,
      [categoryId]: items.filter((row) => row.categoryId === categoryId).length,
    }),
    {},
  );
  const activeCount = items.filter((row) => row.isActive).length;
  const publicCount = items.filter((row) => row.publicVisible).length;
  const reviewCount = items.filter((row) => row.isActive && !row.publicVisible).length;

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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Inventory items" value={items.length} />
        <StatTile label="Active for staff" value={activeCount} />
        <StatTile label="Needs review" value={reviewCount} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <form action="/api/admin/inventory/sync" method="post">
          <input type="hidden" name="token" value={token} />
          <button className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 hover:bg-amber-200">
            Sync Current Website Catalog
          </button>
        </form>
        <Link
          href={`/admin/inventory?${query}`}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Add New Item
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Click a category
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {activeCategory ? CATEGORY_COPY[activeCategory].title : "All inventory"}
            </h2>
          </div>
          <p className="text-sm font-bold text-slate-500">
            Showing {filteredItems.length} of {items.length}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={categoryHref(token)}
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
              href={categoryHref(token, categoryId)}
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
              <h2 className="mt-2 text-2xl font-black">
                {activeCategory
                  ? CATEGORY_COPY[activeCategory].title
                  : `${items.length} items`}
              </h2>
            </div>
            <p className="text-xs font-bold text-slate-500">
              Public-ready: {publicCount}
            </p>
          </div>

          <div className="mt-4 grid max-h-[760px] gap-3 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                Sync the current website catalog to fill this list.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                No items are in this category yet.
              </div>
            ) : (
              filteredItems.map((row) => {
                const counts =
                  rentalCounts.get(row.slug) ?? emptyInventoryCounts(row.slug);
                return (
                <div
                  key={row.id}
                  className={`rounded-xl border p-4 transition ${
                    item?.id === row.id
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                      {row.categoryLabel}
                    </p>
                    <h3 className="mt-1 text-base font-black">{row.title}</h3>
                  </div>
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                    {money(row.startingPrice)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {ROUTE_KIND_LABELS[row.routeKind]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      row.isActive
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      row.publicVisible
                        ? "bg-cyan-100 text-cyan-900"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {row.publicVisible ? "Public-ready" : "Review"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/inventory?${query}${activeCategory ? `&category=${encodeURIComponent(activeCategory)}` : ""}&item=${encodeURIComponent(row.id)}`}
                    className="rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-black text-white hover:bg-sky-600"
                  >
                    {item?.id === row.id ? "Editing" : "Edit"}
                  </Link>
                  <Link
                    href={`/admin/rentals?from=2020-01-01&to=${new Date().toISOString().slice(0, 10)}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100"
                  >
                    Past rentals: {counts.pastRentals}
                  </Link>
                  <Link
                    href={`/admin/rentals?from=${new Date().toISOString().slice(0, 10)}&to=2099-12-31`}
                    className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-black text-sky-900 hover:bg-sky-100"
                  >
                    Future bookings: {counts.futureBookings}
                  </Link>
                </div>
                </div>
              );
              })
            )}
          </div>
        </section>

        <InventoryItemForm
          token={token}
          item={item}
          cancelHref={categoryHref(token, activeCategory)}
        />
      </div>
    </AdminShell>
  );
}
