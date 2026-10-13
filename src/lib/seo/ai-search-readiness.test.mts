import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { default: robots } =
  require("../../app/robots.ts") as typeof import("../../app/robots");
const { default: sitemap } =
  require("../../app/sitemap.ts") as typeof import("../../app/sitemap");
const { default: nextConfig } =
  require("../../../next.config.ts") as typeof import("../../../next.config");
import {
  generateOrganizationSchema,
  generateServiceSchema,
  openingHoursFromDisplay,
} from "../metadata";
import { DEFAULT_SITE_SETTINGS } from "../admin/site-settings";
import { location } from "../../data/site";

test("OAI-SearchBot permits public pages and retains every wildcard private exclusion", () => {
  const rules = robots().rules;
  assert.ok(Array.isArray(rules));
  const general = rules.find((rule) => rule.userAgent === "*")!;
  const search = rules.find((rule) => rule.userAgent === "OAI-SearchBot")!;
  assert.equal(search.allow, "/");
  assert.deepEqual(search.disallow, general.disallow);
  for (const path of [
    "/admin",
    "/api",
    "/driver",
    "/waiver",
    "/facility-parties/invitations",
    "/rental-agreement",
  ])
    assert.ok(search.disallow?.includes(path));
  assert.equal(
    rules.some((rule) => rule.userAgent === "GPTBot"),
    false,
  );
});
test("displayed hours are parsed conservatively without inventing appointment or overnight hours", () => {
  const result = openingHoursFromDisplay([
    { day: "Monday", hours: "9:00 AM - 11:30 AM" },
    { day: "Friday", hours: "12:00 PM – 6:00 PM" },
    { day: "Sunday", hours: "Private parties all day" },
    { day: "Tuesday", hours: "9:00 AM - 5:00 PM", closed: true },
    { day: "Saturday", hours: "9:99 AM - 5:00 PM" },
    { day: "Wednesday", hours: "9:00 PM - 1:00 AM" },
  ]);
  assert.deepEqual(
    result.map((row) => [row.dayOfWeek, row.opens, row.closes]),
    [
      ["Monday", "09:00", "11:30"],
      ["Friday", "12:00", "18:00"],
    ],
  );
});
test("business schema matches displayed settings and facility service remains at Greenwood", () => {
  const settings = {
    ...DEFAULT_SITE_SETTINGS,
    websiteText: {
      ...DEFAULT_SITE_SETTINGS.websiteText,
      contactPhone: "test-phone",
      contactEmail: "test@example.com",
      contactAddress: "New verified address",
    },
    businessHours: [{ day: "Monday", hours: "9:00 AM - 11:30 AM" }],
  };
  const business = generateOrganizationSchema(settings);
  assert.equal(business.telephone, "test-phone");
  assert.equal(business.address, "New verified address");
  assert.equal(business.openingHoursSpecification?.[0].closes, "11:30");
  assert.ok(!JSON.stringify(business).includes("aggregateRating"));
  const facility = generateServiceSchema(
    "Facility",
    "On-site parties",
    "/facility-parties",
    "Party venue",
    "facility",
  );
  assert.deepEqual(
    facility.areaServed.map((row) => row.name),
    ["Greenwood, SC"],
  );
  assert.deepEqual(
    generateServiceSchema(
      "Delivery",
      "Rentals",
      "/rentals",
      "Delivery",
    ).areaServed.map((row) => row.name),
    location.serviceAreas.map((name) => `${name}, SC`),
  );
});
test("sitemap includes canonical service page once and excludes protected routes", async () => {
  const entries = await sitemap();
  assert.equal(
    entries.filter(
      (row) => row.url === "https://jumpingjaxllc.com/service-area",
    ).length,
    1,
  );
  assert.equal(new Set(entries.map((row) => row.url)).size, entries.length);
  assert.ok(
    entries.every((row) => row.url.startsWith("https://jumpingjaxllc.com/")),
  );
  assert.ok(
    entries.every(
      (row) =>
        !/\/(admin|api|waiver|rental-agreement|driver)(\/|$)/.test(row.url),
    ),
  );
});
test("verified legacy city URLs redirect permanently to the live water slide category", async () => {
  const redirects = await nextConfig.redirects!();
  for (const city of ["abbeville", "ware-shoals"]) {
    const redirect = redirects.find(
      (row) => row.source === `/pages/water-slide-rentals-in-${city}-sc`,
    );
    assert.equal(redirect?.destination, "/rentals/water-slides");
    assert.equal(redirect?.permanent, true);
  }
});
