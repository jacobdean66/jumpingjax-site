import assert from "node:assert/strict";
import test from "node:test";
import { emptyTypedAgreement, signatureMatchesName, validateTypedAgreements } from "./typed-agreements";
import type { ParticipantInput } from "./validation";
const adult: ParticipantInput = { tempId: "adult", firstName: "Anne Marie", lastName: "O’Neil", dob: "1990-02-03", role: "adult_signer", adultMode: "watching" };
const child: ParticipantInput = { tempId: "child", firstName: "Child", lastName: "O’Neil", dob: "2024-02-03", role: "child", guardianTempId: "adult" };
const agreement = { ...emptyTypedAgreement("adult"), firstName: "Anne Marie", lastName: "O’Neil", acknowledgedRisk: true, acknowledgedTerms: true, electronicSignature: true, guardianAuthority: true };
test("signature requires matching first AND last names; harmless casing and spacing vary", () => {
  assert.equal(signatureMatchesName({firstName:" ANNE  MARIE ",lastName:"o’neil"},adult),true);
  assert.equal(signatureMatchesName({...agreement,firstName:"Anne"},adult),false);
  assert.equal(signatureMatchesName({...agreement,lastName:"Another"},adult),false);
  assert.equal(signatureMatchesName({...agreement,lastName:"ONeil"},adult),false);
});
test("empty signature and consent never count as an agreement", () => {
  assert.ok(Object.keys(validateTypedAgreements([adult,child],[emptyTypedAgreement("adult")],"2026-10-07")).length);
  assert.deepEqual(validateTypedAgreements([adult,child],[agreement],"2026-10-07"),{});
});
test("each adult must sign individually; duplicate or substituted signer fails", () => {
  const other = {...adult,tempId:"other",firstName:"Second",role:"adult_covered" as const};
  assert.ok(validateTypedAgreements([adult,other,child],[agreement],"2026-10-07").agreements);
  assert.ok(validateTypedAgreements([adult,other,child],[agreement,agreement],"2026-10-07").agreements);
});
test("watching guardian must confirm authority; photo permission is optional", () => {
  assert.ok(validateTypedAgreements([adult,child],[{...agreement,guardianAuthority:false}],"2026-10-07")["agreements.adult.guardian"]);
  assert.deepEqual(validateTypedAgreements([adult,child],[{...agreement,photoConsent:false}],"2026-10-07"),{});
});
test("a minor cannot sign as an adult", () => {
  assert.ok(validateTypedAgreements([{...adult,dob:"2010-02-03"}],[agreement],"2026-10-07")["agreements.adult.age"]);
});
