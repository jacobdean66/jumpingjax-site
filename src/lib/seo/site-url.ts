import { buildAbsoluteUrl, getCanonicalSiteUrl } from "@/lib/site-url";

export function getSeoBaseUrl(): string {
  return getCanonicalSiteUrl();
}

export function absoluteSeoUrl(path: string = "/"): string {
  return buildAbsoluteUrl(path, getSeoBaseUrl()).replace(/\/$/, path === "/" ? "/" : "");
}
