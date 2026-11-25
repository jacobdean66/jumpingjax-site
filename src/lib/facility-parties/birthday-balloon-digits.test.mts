
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  facilityAddonsForStorage,
  formatStoredFacilityAddons,
  getBirthdayBalloonDigits,
  getStoredFacilityAddonsSubtotal,
  previewAddonSubtotal,
  resolveFacilityAddons,
} from "./addons";
import { BirthdayBalloonOption } from "../../components/facility-parties/BirthdayBalloonOption";

const balloon = { customBirthdayBalloons: true };

test("age one costs $10 and age ten costs $20, even with untrusted price/digits", () => {
  const forged = { ...balloon, birthdayBalloonDigits: "1", quantity: 1, unitPrice: 0, subtotal: 0 };
  for (const [age, quantity] of [[1, 1], [10, 2]] as const) {
    const result = resolveFacilityAddons(forged, age);
    assert.equal(result.lines[0].quantity, quantity);
    assert.equal(result.lines[0].unitPrice, 10);
    assert.equal(result.subtotal, quantity * 10);
    assert.equal(previewAddonSubtotal(balloon, String(age)), quantity * 10);
    assert.equal(result.selections.birthdayBalloonDigits, String(age));
  }
  assert.equal(resolveFacilityAddons({}, "10").subtotal, 0);
});

test("server accepts only canonical supported ages and checks before pricing/writing", () => {
  for (const value of [null, undefined, "", "10\n", " 10", "01", "1e1", "10.0", "１０", "x10", 0, 19, 1.5, ["10"], {}]) {
    assert.equal(getBirthdayBalloonDigits(value), null);
  }
  const route = readFileSync(new URL("../../app/api/facility/book/route.ts", import.meta.url), "utf8");
  assert.match(route, /getBirthdayBalloonDigits\(child_age\)[\s\S]*?addon_selections\?\.customBirthdayBalloons === true && !balloonDigits[\s\S]*?status: 400[\s\S]*?resolveFacilityAddons\(addon_selections, balloonDigits\)/);
});

test("stored current and historical add-ons preserve email/admin and pricing", () => {
  const old = { selections: balloon };
  assert.match(formatStoredFacilityAddons(old), /Custom Birthday Balloons — \$10\.00/);
  assert.equal(getStoredFacilityAddonsSubtotal(old), 10);
  const current = resolveFacilityAddons({ ...balloon, goodieBagsQuantity: 2, cottonCandyPackage: "10_kids" }, "10");
  const snapshot = facilityAddonsForStorage(current);
  assert.match(formatStoredFacilityAddons(snapshot), /Number 10.*2 digits.*\$20\.00/);
  assert.equal(getStoredFacilityAddonsSubtotal(snapshot), 42);
  assert.equal(getStoredFacilityAddonsSubtotal({ selections: current.selections }), 42);
});

test("renders the real accessible mobile add-on copy and updates from age", () => {
  const render = (age: string, selected = true) => renderToStaticMarkup(React.createElement(
    BirthdayBalloonOption, { age, selected, onSelectedChange() {} },
  ));
  const ten = render("10");
  assert.match(ten, /aria-live="polite"/);
  const target = ten.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(target && ten.includes('id="' + target + '"'));
  assert.match(ten, /\$10 per digit/);
  assert.match(ten, /Number 10: 2 balloons · \$20/);
  assert.match(render("1"), /Number 1: 1 balloon · \$10/);
  assert.match(render(""), /Enter an age from 1 to 18/);
  assert.doesNotMatch(render("10", false), /Number 10/);
});
