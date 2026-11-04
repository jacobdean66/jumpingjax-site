/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS file for the Votel JavaScript sandbox. */
"use strict";

// Read-only preview integration. Do not change this to a booking endpoint.
const ENDPOINT = "https://jumpingjax-site-glptumf6s-jacobdean66s-projects.vercel.app/api/receptionist/facility-availability";
const empty = (status, message) => ({
  preflight_status: status, message, price_known: "", availability: "",
  quote_json: "", package_price: "", addon_subtotal: "", subtotal: "", tax: "", total: "", ready_marker: "",
  kind: "", room: "", date: "", duration_minutes: "", readable_time: "",
  booking_guaranteed: false, submitted: false,
});
const text = value => typeof value === "string" ? value.trim() : "";
const integer = value => typeof value === "number" && Number.isInteger(value) ? value
  : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;

function normalize(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const kind = text(input.kind).toLowerCase();
  const room = kind === "private" ? "room-20" : text(input.room).replace(/^room_(10|20)$/, "room-$1");
  const durationMinutes = kind === "public" ? 90 : integer(input.duration);
  const dateMatch = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00)?$/.exec(text(input.date));
  if (!dateMatch) return null;
  const date = dateMatch[1];
  // Validate the date in UTC, but keep the original calendar date for the website.
  const day = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return null;
  const startTime = text(input.start_time);
  // Votel's dropdown IDs use underscores for the configured 10:00–19:00 half-hour options.
  const timeLabel = /^(?:1[0-8]_(?:00|30)|19_00)$/.test(startTime)
    ? startTime.replace("_", ":")
    : startTime;
  const clock = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(timeLabel);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (minute > 59 || (clock[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (clock[3]) hour = hour % 12 + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  const balloons = typeof input.balloons === "boolean" ? String(input.balloons) : text(input.balloons).toLowerCase();
  const goodieBagsQuantity = integer(input.goodie_bags);
  const cottonCandyPackage = text(input.cotton).toLowerCase();
  if (!["public", "private"].includes(kind) || !["room-10", "room-20"].includes(room) ||
      ![90, 120, 180].includes(durationMinutes) ||
      !["yes", "no", "true", "false"].includes(balloons) ||
      !Number.isSafeInteger(goodieBagsQuantity) || goodieBagsQuantity < 0 || goodieBagsQuantity > 100 ||
      !["none", "10_kids", "20_kids"].includes(cottonCandyPackage)) return null;
  return { schemaVersion: 1, kind, room, date, startMinutes: hour * 60 + minute, durationMinutes,
    addons: { customBirthdayBalloons: balloons === "yes" || balloons === "true", goodieBagsQuantity, cottonCandyPackage } };
}

function verifiedResponse(value, request) {
  if (!value || value.schemaVersion !== 1 || value.bookingGuaranteed !== false || value.finalReviewRequired !== true ||
      !["open-for-review", "unavailable"].includes(value.availability)) return false;
  const q = value.quote;
  if (!q || q.schemaVersion !== 1 || q.finalReviewRequired !== true || q.availability !== "not-checked" ||
      ["kind", "room", "date", "startMinutes", "durationMinutes"].some(key => q[key] !== request[key]) ||
      q.endMinutes !== request.startMinutes + request.durationMinutes || !q.addons ||
      Object.keys(request.addons).some(key => q.addons[key] !== request.addons[key])) return false;
  const money = [q.packagePrice, q.addonSubtotal, q.subtotal, q.tax, q.total];
  if (money.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 2_000_000 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) ||
      q.packagePrice <= 0 || typeof q.taxRate !== "number" || !Number.isFinite(q.taxRate) || q.taxRate < 0 || q.taxRate > 1) return false;
  const cents = n => Math.round(n * 100);
  return cents(q.subtotal) === cents(q.packagePrice) + cents(q.addonSubtotal) &&
    cents(q.tax) === Math.round(q.subtotal * q.taxRate * 100) && cents(q.total) === cents(q.subtotal) + cents(q.tax);
}

async function runPreflight(input, fetcher = fetch) {
  const request = normalize(input);
  if (!request) return empty("needs_details", "The party choices are incomplete or invalid. Confirm the exact package, date, time and add-ons before checking again.");
  // This endpoint supplies standard prices; it does not validate promotion codes.
  if (text(input.promo) && !/^(none|no)$/i.test(text(input.promo))) {
    return empty("promotion_needs_review", "A promotion code needs verification before an accurate final quote can be confirmed.");
  }
  try {
    const response = await fetcher(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: AbortSignal.timeout(8000), redirect: "error" });
    if (response.status === 400) return empty("needs_details", "The website does not support that party date, time or option. Confirm another supported choice.");
    if (!response.ok) return empty("check_failed", "I could not verify the current price and availability. No booking has been submitted.");
    const value = await response.json();
    if (!verifiedResponse(value, request)) return empty("check_failed", "The website response could not be verified. No booking has been submitted.");
    const q = value.quote;
    // Votel treats JavaScript template interpolation as workflow references.
    const clock = minutes => (Math.floor(minutes / 60) % 12 || 12) + ":" + String(minutes % 60).padStart(2, "0") + " " + (Math.floor(minutes / 60) % 24 >= 12 ? "PM" : "AM");
    return { ...empty(value.availability === "open-for-review" ? "ready_for_review" : "unavailable",
      value.availability === "open-for-review" ? "The requested time is open for review; it is not held or booked." : "The requested time is unavailable. Choose another time."),
      price_known: "yes", availability: value.availability, quote_json: JSON.stringify(q),
      package_price: q.packagePrice.toFixed(2), addon_subtotal: q.addonSubtotal.toFixed(2),
      subtotal: q.subtotal.toFixed(2), tax: q.tax.toFixed(2), total: q.total.toFixed(2),
      ready_marker: value.availability === "open-for-review" ? "yes" : "",
      kind: q.kind, room: q.room, date: q.date, duration_minutes: String(q.durationMinutes),
      readable_time: clock(q.startMinutes) + " - " + clock(q.endMinutes) };
  } catch {
    return empty("check_failed", "I could not verify the current price and availability. No booking has been submitted.");
  }
}

module.exports = { runPreflight, normalize, verifiedResponse, ENDPOINT };
if (require.main === module) {
  const fs = require("node:fs");
  (async () => {
    let result;
    try { result = await runPreflight(JSON.parse(fs.readFileSync(process.env.VOTEL_INPUT, "utf8"))); }
    catch { result = empty("check_failed", "The request could not be verified. No booking has been submitted."); }
    fs.writeFileSync(process.env.VOTEL_OUTPUT, JSON.stringify(result));
  })().catch(() => { process.exitCode = 1; });
}
