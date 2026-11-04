"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { searchAdminPages, type AdminSearchEntry } from "@/lib/admin/navigation";

export function AdminPageSearch({ entries }: { entries: AdminSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const results = searchAdminPages(entries, query);

  return (
    <div className="relative my-3 w-full max-w-md text-slate-950">
      <label htmlFor={id} className="mb-1 inline-block rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-800">Find a dashboard page</label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder="Search pages, e.g. invoices"
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Escape" && query) {
            event.stopPropagation();
            setQuery("");
          }
        }}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-600 focus:outline-2 focus:outline-sky-600"
      />
      {query.trim().length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p role="status" className="px-2 py-1 text-xs text-slate-600">
            {results.length ? `${results.length} ${results.length === 1 ? "page" : "pages"} found` : "No matching pages found"}
          </p>
          <ul>
            {results.map(({ item, group }) => (
              <li key={item.id}>
                <Link href={item.href} prefetch={false} onClick={event => {
                  setQuery("");
                  event.currentTarget.closest(".admin-navigation")?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
                }} className="block rounded-lg px-2 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100 focus-visible:bg-slate-100">
                  {item.label}<span className="ml-2 text-xs font-normal text-slate-600">{group}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
