import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { facilityGoogleDiscount, personalGoogleCode } from "./customer-offer";
import { GoogleOfferCard } from "../../components/GoogleOfferCard";

const code = "JAX-" + "A".repeat(32);
test("personal code syntax rejects shared codes and arbitrary percentages", () => {
  assert.equal(personalGoogleCode("GOOGLE15"), "");
  assert.equal(personalGoogleCode("GOOGLE100"), "");
  assert.equal(personalGoogleCode(" " + code.toLowerCase() + " "), code);
});
test("facility savings cover only the base package, before tax", () => {
  const pricing = {
    packagePrice: 120,
    addonSubtotal: 30,
    subtotal: 150,
    tax: 10.5,
    total: 160.5,
    taxRate: 0.07,
  };
  const result = facilityGoogleDiscount(pricing, code);
  assert.equal(result.googleDiscount, 18);
  assert.equal(result.addonSubtotal, 30);
  assert.equal(result.packagePrice, 120);
  assert.equal(result.subtotal, 132);
  assert.equal(result.tax, 9.24);
  assert.equal(result.total, 141.24);
  assert.deepEqual(facilityGoogleDiscount(pricing, ""), {
    ...pricing,
    googleDiscount: 0,
  });
});
test("a staff card shows the exact saved offer, amount and state without discounting twice", () => {
  const html = renderToStaticMarkup(
    createElement(GoogleOfferCard, {
      kind: "facility",
      offer: { code, discount: 18, status: "reserved" },
    }),
  );
  assert.match(html, /Savings already included: \$18\.00/);
  assert.match(html, /Reserved for this booking/);
  assert.match(html, /base party package/);
  assert.match(html, /Do not apply a second discount/);
  assert.equal(
    renderToStaticMarkup(createElement(GoogleOfferCard, { kind: "rental" })),
    "",
  );
});
