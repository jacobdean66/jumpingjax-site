import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { visitMatchesSearch, visitBookingHref } from "./visit-hub";
import { resolveRentalDashboardDates, rentalMatchesDashboardDates } from "./rental-dashboard-view";

const require = createRequire(import.meta.url);
const { default: VisitPage } = require("../../app/visit/page.tsx");
const { default: FacilityVisitPage } = require("../../app/visit/facility/page.tsx");
const { default: RentalVisitPage } = require("../../app/visit/rentals/page.tsx");

test("staff lookup finds normalized contact information without treating short digit fragments as identity", () => {
  assert.equal(visitMatchesSearch(["Alex Guest", "ALEX@example.invalid", "(864) 555-0100"], "alex@EXAMPLE.invalid"), true);
  assert.equal(visitMatchesSearch(["(864) 555-0100"], "8645550100"), true);
  assert.equal(visitMatchesSearch(["(864) 555-0100"], "84"), false);
  assert.equal(visitMatchesSearch([null, undefined], "Guest"), false);
  assert.equal(visitMatchesSearch(["Alex Guest"], ""), true);
});

test("booking links preserve historic dates and use facility anchors instead of unsupported ID searches", () => {
  const rental = new URL(visitBookingHref("rentals", "42&status=approved", "2026-10-21", "2026-10-22"), "https://example.invalid");
  assert.equal(rental.searchParams.get("q"), "42&status=approved");
  assert.equal(rental.searchParams.get("status"), "all");
  const party = new URL(visitBookingHref("facility", "party-123", "2026-10-21", "2026-10-22"), "https://example.invalid");
  assert.equal(party.searchParams.get("view"), "past");
  assert.equal(party.searchParams.has("q"), false);
  assert.equal(party.hash, "#booking-party-123");
});

test("the selected visit day includes an ongoing rental and rejects impossible dates", () => {
  const dates = resolveRentalDashboardDates({ from: "2026-10-22", to: "2026-10-22" }, "2026-10-22");
  assert.equal(rentalMatchesDashboardDates("2026-10-21", 2, dates), true);
  assert.equal(rentalMatchesDashboardDates("2026-10-21", 1, dates), false);
  assert.equal(resolveRentalDashboardDates({ from: "2026-02-30" }).from, null);
});

test("customer paths keep rental agreements and facility waivers separate without a broken generic party link", () => {
  const hub = renderToStaticMarkup(createElement(VisitPage));
  assert.match(hub, /href="\/visit\/rentals"/);
  assert.match(hub, /href="\/visit\/facility"/);
  const rentals = renderToStaticMarkup(createElement(RentalVisitPage));
  assert.match(rentals, /href="\/rentals#rental-categories"/);
  assert.doesNotMatch(rentals, /href="\/waiver"/);
  const facility = renderToStaticMarkup(createElement(FacilityVisitPage));
  assert.match(facility, /href="\/waiver"/);
  assert.match(facility, /does not apply to facility admission or parties/);
  assert.doesNotMatch(facility, /href="\/facility-party-check-in"|Claim my 15%|use my code/);
});
