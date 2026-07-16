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

function InventoryForm({
  token,
  item,
}: {
  token: string;
  item?: AdminInventoryItem;
}) {
  return (
    <form
      action="/api/admin/inventory/item"
      method="post"
      encType="multipart/form-data"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="token" value={token} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="imageSrc" value={item?.imageSrc ?? ""} />

      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Inventory Editor
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {item ? `Edit ${item.title}` : "Add a rental item"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {item ? (
            <button
              formAction="/api/admin/inventory/delete"
              className="rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white hover:bg-rose-600"
            >
              Delete Item
            </button>
          ) : null}
          <button className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">
            Save Item
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Item name
          <input
            name="title"
            required
            defaultValue={item?.title ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Category
          <select
            name="categoryId"
            defaultValue={item?.categoryId ?? "bounce-houses"}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {CATEGORY_COPY[id].title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Starting price
          <input
            name="startingPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.startingPrice ?? 0}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Rental photo
          <input
            name="imageFile"
            type="file"
            accept="image/*"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-sky-600"
          />
          {item?.imageSrc ? (
            <span className="mt-2 block break-all text-xs font-semibold text-slate-500">
              Current photo saved.
            </span>
          ) : (
            <span className="mt-2 block text-xs font-semibold text-slate-500">
              Choose a photo from this computer.
            </span>
          )}
        </label>
        <label className="text-sm font-bold text-slate-700">
          Image description
          <input
            name="imageAlt"
            defaultValue={item?.imageAlt ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="text-sm font-bold text-slate-700">
          Short card description
          <textarea
            name="shortDescription"
            rows={3}
            defaultValue={item?.shortDescription ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Full page description
          <textarea
            name="description"
            rows={5}
            defaultValue={item?.description ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Age recommendation
          <input
            name="ageRecommendation"
            defaultValue={item?.ageRecommendation ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Setup requirements
          <textarea
            name="setupRequirements"
            rows={5}
            defaultValue={(item?.setupRequirements ?? []).join("\n")}
            placeholder="One requirement per line"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Route planner type
          <select
            name="routeKind"
            defaultValue={item?.routeKind ?? "standard"}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {Object.entries(ROUTE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Setup minutes
          <input
            name="estimatedSetupMinutes"
            type="number"
            min="0"
            max="240"
            defaultValue={item?.estimatedSetupMinutes ?? 45}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={item?.isActive ?? true}
            className="mt-1 h-4 w-4"
          />
          Active for employees
        </label>
        <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
          <input
            name="publicVisible"
            type="checkbox"
            defaultChecked={item?.publicVisible ?? false}
            className="mt-1 h-4 w-4"
          />
          Approved for public website later
        </label>
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-800">
          Advanced website settings
        </summary>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-bold text-slate-700">
            Website link name
            <input
              name="slug"
              defaultValue={item?.slug ?? ""}
              placeholder="Leave blank to make this automatically"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            This is made automatically from the item name. Only change it if a
            manager asks you to.
          </p>
        </div>
      </details>
    </form>
  );
}

export default async function AdminInventoryPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess(token);

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
                <Link
                  href={`/admin/inventory?${query}${activeCategory ? `&category=${encodeURIComponent(activeCategory)}` : ""}&item=${encodeURIComponent(row.id)}`}
                  className="block hover:opacity-95"
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
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
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

        <InventoryForm token={token} item={item} />
      </div>
    </AdminShell>
  );
}
