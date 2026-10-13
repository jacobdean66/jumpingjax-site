import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmailAddress } from "./address.ts";

test("single-mailbox validation rejects the recorded comma typo and recipient lists", () => {
  for (const invalid of ["coscram,2018@gmail.com", "a@example.com,b@example.com", "Parent <a@example.com>", "a..b@example.com", "@gmail.com", "a@gmail"]) assert.equal(isValidEmailAddress(invalid), false, invalid);
  for (const valid of ["parent+party@gmail.com", " Wrightkaila@gmail.com ", "test@example.invalid"]) assert.equal(isValidEmailAddress(valid), true, valid);
});
