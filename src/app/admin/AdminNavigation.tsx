"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { adminNavigation, isAdminNavActive, type AdminNavItem } from "@/lib/admin/navigation";
import type { AdminRole } from "@/lib/admin/delivery-auth";
import { AdminBackButton } from "./AdminBackButton";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { PermanentAgentSummary } from "./PermanentAgentSummary";

export function AdminNavigation({ role, variant = "standard" }: { role: AdminRole; variant?: "standard" | "home" | "route" | "social" }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLDivElement>(null);
  const { primary, groups } = adminNavigation(role);
  useEffect(() => {
    const navigation = navigationRef.current;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !navigation?.contains(event.target)) {
        navigation?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
      }
    }
    function sizeMobileMenu() {
      const menu = navigation?.querySelector<HTMLDetailsElement>(".admin-nav-mobile-menu[open]");
      const panel = menu?.querySelector<HTMLElement>(".admin-nav-mobile-panel");
      const row = menu?.parentElement;
      if (!panel || !row) return;
      const top = row.getBoundingClientRect().bottom;
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      panel.style.setProperty("--menu-available-height", `${Math.max(120, bottom - top - 28)}px`);
    }
    document.addEventListener("pointerdown", dismissOutside);
    navigation?.addEventListener("toggle", sizeMobileMenu, true);
    window.addEventListener("resize", sizeMobileMenu);
    window.addEventListener("scroll", sizeMobileMenu, { passive: true });
    window.visualViewport?.addEventListener("resize", sizeMobileMenu);
    window.visualViewport?.addEventListener("scroll", sizeMobileMenu);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      navigation?.removeEventListener("toggle", sizeMobileMenu, true);
      window.removeEventListener("resize", sizeMobileMenu);
      window.removeEventListener("scroll", sizeMobileMenu);
      window.visualViewport?.removeEventListener("resize", sizeMobileMenu);
      window.visualViewport?.removeEventListener("scroll", sizeMobileMenu);
    };
  }, []);
  function linkClass(active: boolean, id?: string) {
    if (variant === "home") return "ah-nav-link text-xs font-black";
    if (variant === "route") return `${active ? "rp-nav-link-accent" : "rp-nav-link"} rounded-lg px-3 py-2 text-xs font-black`;
    if (variant === "social") return "sp-nav-link text-xs font-black";
    if (id === "open-play" || id === "rentals") return `inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold ${active ? "bg-pink-600 text-white shadow-sm" : "border-2 border-pink-500 bg-pink-50 text-pink-900 hover:bg-pink-100"}`;
    return `inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  }
  function renderLink(item: AdminNavItem) {
    const active = isAdminNavActive(item, pathname);
    return <Link key={item.id} href={item.href} prefetch={false} className={linkClass(active, item.id)} aria-current={active ? "page" : undefined} onClick={event => { event.currentTarget.closest(".admin-navigation")?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open")); }}>{item.label}</Link>;
  }
  const surface = variant === "home" ? "ah-panel" : variant === "route" ? "rp-panel" : "rounded-xl border border-slate-200 bg-white shadow-lg";
  function otherTools(mobile = false) {
    return <nav aria-label="Other admin tools" className="mt-2 flex flex-wrap items-start gap-2">
      {groups.map((group, index) => <details key={group.label} className={mobile ? "w-full" : "relative"} name={mobile ? "mobile-admin-navigation-group" : "admin-navigation-group"}>
        <summary className={`${linkClass(group.items.some(item => isAdminNavActive(item, pathname)))} cursor-pointer list-none after:ml-2 after:content-['▾']`}>{group.label}</summary>
        <div style={variant === "home" ? { background: "var(--ah-panel)" } : undefined} className={`${surface} admin-nav-group-panel ${mobile ? "mt-2" : `admin-nav-dropdown-panel absolute ${index > 1 ? "right-0" : "left-0"} top-full z-40 mt-3 min-w-52 max-w-[calc(100vw-3rem)]`} grid max-h-[65vh] gap-2 overflow-y-auto p-3`}>
          {group.items.map(renderLink)}
        </div>
      </details>)}
      <Link href="/" className={variant === "standard" ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600" : linkClass(false)}>View Website</Link>
      <AdminBackButton compact className={variant === "standard" ? undefined : linkClass(false)} />
      <AdminLogoutButton compact className={variant === "standard" ? undefined : linkClass(false)} />
    </nav>;
  }
  return <div ref={navigationRef} className="admin-navigation admin-nav-3d my-3 min-w-0 print:hidden" onKeyDown={event => {
    if (event.key !== "Escape") return;
    const menu = event.currentTarget.querySelector<HTMLDetailsElement>("details[open]");
    event.currentTarget.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
    menu?.querySelector<HTMLElement>("summary")?.focus();
  }}>
    <div className="hidden sm:block">
    <nav aria-label="Front desk navigation" className="flex flex-wrap gap-2">
      {primary.map(renderLink)}
    </nav>
    {otherTools()}
    </div>
    <nav aria-label="Mobile admin navigation" className="admin-nav-mobile-row flex flex-wrap items-start gap-2 sm:hidden">
      {primary.filter(item => item.id === "home" || item.id === "agents").map(renderLink)}
      <details className="admin-nav-mobile-menu">
        <summary className={`${linkClass(false)} cursor-pointer list-none`}>Menu ▾</summary>
        <div style={variant === "home" ? { background: "var(--ah-panel)" } : undefined} className={`${surface} admin-nav-mobile-panel`}>
          <nav aria-label="Front desk tasks" className="grid gap-2">{primary.filter(item => item.id !== "home" && item.id !== "agents").map(renderLink)}</nav>
          {otherTools(true)}
        </div>
      </details>
    </nav>
    {role === "owner" ? <PermanentAgentSummary variant={variant === "social" ? "standard" : variant} /> : null}
  </div>;
}
