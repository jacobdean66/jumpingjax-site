import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nextConfig = readFileSync(
  new URL("../../../next.config.ts", import.meta.url),
  "utf8",
);
const categoryPage = readFileSync(
  new URL("../../app/rentals/[category]/page.tsx", import.meta.url),
  "utf8",
);
const customerForm = readFileSync(
  new URL("../../components/booking/CustomerForm.tsx", import.meta.url),
  "utf8",
);
const rentalBookingPanel = readFileSync(
  new URL("../../components/booking/RentalBookingPanel.tsx", import.meta.url),
  "utf8",
);
const facilityBookingForm = readFileSync(
  new URL(
    "../../components/facility-parties/FacilityPartyBookingForm.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("obsolete water-slide URLs permanently consolidate into the canonical category", () => {
  assert.match(nextConfig, /pages\/water-slide-rentals-in-greenwood-sc/);
  assert.match(nextConfig, /category\/waterslides/);
  assert.match(nextConfig, /destination: "\/rentals\/water-slides"/);
  assert.equal(nextConfig.match(/statusCode: 301/g)?.length, 2);
});

test("primary local keyword clusters have one visible category target", () => {
  for (const phrase of [
    "Bounce House Rentals in Greenwood, SC",
    "Water Slide Rentals in Greenwood, SC",
    "Foam Party Rentals in Greenwood, SC",
    "Inflatable Obstacle Course Rentals in Greenwood, SC",
  ]) {
    assert.match(categoryPage, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(categoryPage, /Kids' birthday party venue/);
});

test("production checkout copy describes the actual follow-up workflow", () => {
  assert.doesNotMatch(customerForm, /not sent anywhere|in this demo/i);
  assert.match(customerForm, /review your rental request/);
});

test("successful rental and facility requests emit lead events", () => {
  assert.match(rentalBookingPanel, /trackLead\("rental_request"/);
  assert.match(facilityBookingForm, /trackLead\("facility_party_request"/);
});
