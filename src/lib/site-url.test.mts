import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_PRODUCTION_SITE_URL,
  buildAbsoluteUrl,
  getCanonicalSiteUrl,
  resolveEmailSiteUrl,
} from "./site-url";
import {
  facilityConfirmLink,
  rentalConfirmLink,
} from "./rentals/rental-site-url";
import { absoluteSeoUrl, getSeoBaseUrl } from "./seo/site-url";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.afterEach(restoreEnvironment);

test("production URL resolution is HTTPS and pinned to the apex .com", () => {
  process.env.NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://jumpingjaxllc.net";
  process.env.VERCEL_URL = "jumpingjax-site-example.vercel.app";

  assert.equal(CANONICAL_PRODUCTION_SITE_URL, "https://jumpingjaxllc.com");
  assert.equal(getCanonicalSiteUrl(), "https://jumpingjaxllc.com");
  assert.equal(
    resolveEmailSiteUrl("https://jumpingjaxllc.net/rentals"),
    "https://jumpingjaxllc.com",
  );
  assert.match(resolveEmailSiteUrl(), /^https:\/\//);
  assert.doesNotMatch(resolveEmailSiteUrl(), /\.net|vercel\.app|localhost/);
});

test("local development can use localhost", () => {
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL_ENV;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";

  assert.equal(resolveEmailSiteUrl(), "http://localhost:3000");
});

test("rental and facility action links use canonical encoded URLs without duplicate slashes", () => {
  const rentalConfirm = rentalConfirmLink(
    "https://jumpingjaxllc.com///",
    "rental / 42",
    "confirm",
  );
  const rentalReject = rentalConfirmLink(
    CANONICAL_PRODUCTION_SITE_URL,
    "rental-42",
    "reject",
  );
  const facilityConfirm = facilityConfirmLink(
    CANONICAL_PRODUCTION_SITE_URL,
    "facility / 7",
    "confirm",
  );
  const facilityReject = facilityConfirmLink(
    CANONICAL_PRODUCTION_SITE_URL,
    "facility-7",
    "reject",
  );

  for (const url of [rentalConfirm, rentalReject, facilityConfirm, facilityReject]) {
    assert.equal(new URL(url).origin, CANONICAL_PRODUCTION_SITE_URL);
    assert.doesNotMatch(url.replace("https://", ""), /\/\//);
    assert.doesNotMatch(url, /jumpingjaxllc\.net/);
  }
  assert.equal(new URL(rentalConfirm).searchParams.get("id"), "rental / 42");
  assert.equal(new URL(facilityConfirm).searchParams.get("id"), "facility / 7");
});

test("canonical metadata and SEO URLs use the apex .com", () => {
  assert.equal(getSeoBaseUrl(), CANONICAL_PRODUCTION_SITE_URL);
  assert.equal(absoluteSeoUrl("/rentals"), "https://jumpingjaxllc.com/rentals");
  assert.equal(
    buildAbsoluteUrl("//facility-parties"),
    "https://jumpingjaxllc.com/facility-parties",
  );
});
