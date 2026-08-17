"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ROUTE_KIND_LABELS,
  type AdminInventoryItem,
  type RouteKind,
} from "@/lib/admin/inventory";

type InventoryListItem = Pick<
  AdminInventoryItem,
  | "id"
  | "slug"
  | "categoryLabel"
  | "title"
  | "startingPrice"
  | "routeKind"
  | "isActive"
  | "publicVisible"
>;

type VisibilityFilter = "all" | "review" | "public";

type RentalCount = {
  pastRentals: number;
  futureBookings: number;
};

type Props = {
  items: InventoryListItem[];
  totalItemCount: number;
  selectedItemId?: string;
  token: string;
  activeCategory?: string;
  visibilityFilter: VisibilityFilter;
  rentalCounts: Record<string, RentalCount>;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function itemMatchesSearch(item: InventoryListItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.title,
    item.categoryLabel,
    item.slug,
    ROUTE_KIND_LABELS[item.routeKind as RouteKind] ?? item.routeKind,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function InventoryList({
  items,
  totalItemCount,
  selectedItemId,
  token,
  activeCategory,
  visibilityFilter,
  rentalCounts,
}: Props) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visibleItems = query
    ? items.filter((row) => itemMatchesSearch(row, query))
    : items;

  const baseQuery = `token=${encodeURIComponent(token)}`;

  return (
    <>
      <label className="mt-4 block">
        <span className="sr-only">Search inventory</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search inflatables by name…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none ring-sky-300 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2"
        />
      </label>
      {query ? (
        <p className="mt-2 text-xs font-bold text-slate-500">
          {visibleItems.length} match{visibleItems.length === 1 ? "" : "es"} for
          “{search.trim()}”
        </p>
      ) : null}

      <div className="mt-4 grid max-h-[760px] gap-3 overflow-y-auto pr-1">
        {totalItemCount === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            Sync the current website catalog to fill this list.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            {visibilityFilter === "review"
              ? "Nothing needs website review right now."
              : visibilityFilter === "public"
                ? "No items are on the website in this view yet."
                : "No items are in this category yet."}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            No inflatables match “{search.trim()}”.
          </div>
        ) : (
          visibleItems.map((row) => {
            const counts = rentalCounts[row.slug] ?? {
              pastRentals: 0,
              futureBookings: 0,
            };
            const itemQuery = `${baseQuery}${
              activeCategory
                ? `&category=${encodeURIComponent(activeCategory)}`
                : ""
            }${
              visibilityFilter !== "all"
                ? `&visibility=${encodeURIComponent(visibilityFilter)}`
                : ""
            }&item=${encodeURIComponent(row.id)}`;
            const itemHref = `/admin/inventory?${itemQuery}`;
            const selected = selectedItemId === row.id;
            return (
              <div
                key={row.id}
                className={`relative rounded-xl border p-4 transition ${
                  selected
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/60"
                }`}
              >
                <Link
                  href={itemHref}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`${selected ? "Viewing" : "View"} ${row.title}`}
                />
                <div className="pointer-events-none relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                        {row.categoryLabel}
                      </p>
                      <h3 className="mt-1 text-base font-black text-slate-950">
                        {row.title}
                      </h3>
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
                      {row.publicVisible ? "On website" : "Review"}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 mt-3 flex flex-wrap gap-2">
                  <Link
                    href={itemHref}
                    className="rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-black text-white hover:bg-sky-600"
                  >
                    {selected ? "Viewing" : "View info"}
                  </Link>
                  <form
                    action="/api/admin/inventory/visibility"
                    method="post"
                    className="inline"
                  >
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="id" value={row.id} />
                    {activeCategory ? (
                      <input type="hidden" name="category" value={activeCategory} />
                    ) : null}
                    {visibilityFilter !== "all" ? (
                      <input
                        type="hidden"
                        name="visibility"
                        value={visibilityFilter}
                      />
                    ) : null}
                    <input
                      type="hidden"
                      name="publicVisible"
                      value={row.publicVisible ? "false" : "true"}
                    />
                    <button
                      className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                        row.publicVisible
                          ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-cyan-500 text-white hover:bg-cyan-600"
                      }`}
                    >
                      {row.publicVisible
                        ? "Remove from website"
                        : "Approve for website"}
                    </button>
                  </form>
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
    </>
  );
}
