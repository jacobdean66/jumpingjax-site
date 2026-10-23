import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingSummary } from "../../components/booking/BookingSummary";
import { RentalPromotionEntry, ClaimRentalPromotion } from "../../components/booking/RentalPromotion";
import { ONE_DAY_RENTAL_DURATION } from "../mockBooking";

test("the estimate shows the visible code, exact saving and discounted total without discounting delivery", () => {
  const html = renderToStaticMarkup(createElement(BookingSummary, { cartItems: [{ rental_item: "castle", rental_name: "Castle", starting_price: 150 }], selectedYmd: "2026-11-12", duration: ONE_DAY_RENTAL_DURATION, selectionValid: true, distanceMiles: "0", promotionDiscount: 22.5 }));
  assert.match(html, /Google offer · 15% off eligible inflatables/);
  assert.match(html, /−\$22\.50/);
  assert.match(html, /\$152\.50/);
  assert.match(html, /Delivery &amp; setup/);
  assert.match(html, /\$25/);
});
test("a browser without an offer can enter a promo code without nesting forms or submitting the booking", () => {
  const html = renderToStaticMarkup(createElement(RentalPromotionEntry, { discount: 0, eligibleItems: true }));
  assert.match(html, /Have a Google discount code/);
  assert.match(html, /id="google-code-rental"/);
  assert.match(html, /type="button"/);
  assert.doesNotMatch(html, /<form|type="submit"|applied: you save/);
  const offer = renderToStaticMarkup(createElement(ClaimRentalPromotion));
  assert.match(offer, /Get my personal 15% code/);
  assert.match(offer, /Your booking email/);
  assert.match(offer, /Facility party/);
});
