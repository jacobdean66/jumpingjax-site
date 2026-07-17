"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    label: "Create and Review",
    items: [
      { href: "/admin/social-posts", label: "Social Post Drafts", exact: true },
      { href: "/admin/social-posts/working-context", label: "Working context" },
    ],
  },
  {
    label: "Intelligence and Planning",
    items: [
      { href: "/admin/social-posts/memory", label: "Campaign memory" },
      { href: "/admin/social-posts/seasonal-intelligence", label: "Seasonal intelligence" },
      { href: "/admin/social-posts/asset-intelligence", label: "Asset intelligence" },
      { href: "/admin/social-posts/campaign-planner", label: "Campaign planner" },
      { href: "/admin/social-posts/creative-brief-intelligence", label: "Creative brief intelligence" },
      { href: "/admin/social-posts/content-draft-specification", label: "Content draft specification" },
      { href: "/admin/social-posts/draft-compliance-validator", label: "Draft compliance validator" },
    ],
  },
  {
    label: "Publishing",
    items: [
      { href: "/admin/social-posts/publication-manifest", label: "Publication manifest" },
      { href: "/admin/social-posts/publication-scheduler", label: "Publication scheduler" },
      { href: "/admin/social-posts/publication-publisher", label: "Publication publisher" },
      { href: "/admin/social-posts/publication-metrics", label: "Publication metrics" },
      { href: "/admin/social-posts/publication-ledger", label: "Publication ledger" },
      { href: "/admin/social-posts/publication-learning", label: "Publication learning" },
      { href: "/admin/social-posts/publication-execution", label: "Publication execution" },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/admin/social-posts/operations", label: "AI Operations Console" }],
  },
];

function withQuery(href: string, query: string): string {
  if (!query) return href;
  return href.includes("?") ? `${href}&${query}` : `${href}?${query}`;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function SocialPostsNav({ query = "" }: { query?: string }) {
  const pathname = usePathname() || "/admin/social-posts";

  return (
    <nav className="sp-nav" aria-label="AI Marketing navigation">
      {GROUPS.map((group) => (
        <div key={group.label} className="sp-nav-group">
          <p className="sp-nav-label">{group.label}</p>
          <div className="sp-nav-links">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={withQuery(item.href, query)}
                  className="sp-nav-link"
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="sp-nav-group">
        <p className="sp-nav-label">Admin</p>
        <div className="sp-nav-links">
          <Link
            href={withQuery("/admin", query)}
            className="sp-nav-link sp-nav-link-admin"
          >
            Admin home
          </Link>
        </div>
      </div>
    </nav>
  );
}
