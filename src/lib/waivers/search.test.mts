import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeLikePattern,
  filterAndRankSearchResults,
  normalizeSearchQuery,
  type SearchableParticipant,
  WaiverSearchValidationError,
} from "./search";

const base: SearchableParticipant[] = [
  {
    participantId: "p1",
    submissionId: "s1",
    firstName: "Ava",
    lastName: "Smith",
    dob: "2019-01-01",
    role: "child",
    expiresOnYmd: "2029-01-01",
    expired: false,
    signerFirstName: "Taylor",
    signerLastName: "Smith",
  },
  {
    participantId: "p2",
    submissionId: "s2",
    firstName: "ava",
    lastName: "Jones",
    dob: "2018-05-05",
    role: "child",
    expiresOnYmd: "2020-01-01",
    expired: true,
    signerFirstName: "Jordan",
    signerLastName: "Jones",
  },
  {
    participantId: "p3",
    submissionId: "s3",
    firstName: "Noah",
    lastName: "Smith",
    dob: "2020-02-02",
    role: "child",
    expiresOnYmd: "2030-02-02",
    expired: false,
    signerFirstName: "Casey",
    signerLastName: "Smith",
  },
];

test("first-name search is case-insensitive", () => {
  const results = filterAndRankSearchResults(base, "AVA");
  assert.equal(results.length, 2);
  assert.ok(results.every((item) => item.firstName.toLowerCase() === "ava"));
});

test("last-name search works", () => {
  const results = filterAndRankSearchResults(base, "smith");
  assert.equal(results.length, 2);
  assert.ok(results.every((item) => item.lastName.toLowerCase() === "smith"));
});

test("full-name search works", () => {
  const results = filterAndRankSearchResults(base, "Noah Smith");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.participantId, "p3");
});

test("common duplicate first names are disambiguated by last name and dob order", () => {
  const results = filterAndRankSearchResults(base, "ava");
  assert.equal(results[0]?.lastName, "Jones");
  assert.equal(results[1]?.lastName, "Smith");
});

test("expired results remain visible with expired flag and privacy-minimized fields", () => {
  const results = filterAndRankSearchResults(base, "ava jones");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.expired, true);
  assert.equal(results[0]?.birthYear, 2018);
  assert.equal(results[0]?.signerLastInitial, "J");
  assert.equal((results[0] as { dob?: string }).dob, undefined);
});

test("search query validation rejects short, empty, and wildcard queries", () => {
  assert.throws(() => normalizeSearchQuery(" "), WaiverSearchValidationError);
  assert.throws(() => normalizeSearchQuery("a"), WaiverSearchValidationError);
  assert.throws(() => normalizeSearchQuery("%"), WaiverSearchValidationError);
  assert.throws(() => normalizeSearchQuery("sm_th"), WaiverSearchValidationError);
  assert.throws(() => normalizeSearchQuery("a,b"), WaiverSearchValidationError);
  assert.throws(() => normalizeSearchQuery("(ava)"), WaiverSearchValidationError);
});

test("escapeLikePattern escapes wildcards", () => {
  assert.equal(escapeLikePattern("a%b_c"), "a\\%b\\_c");
});
