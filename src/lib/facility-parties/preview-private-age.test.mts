import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { parsePreview } from "./preview-email";

test("private age proof binds derived age to the exact call and preview without carrying a birthdate", (t) => {
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-11-04T15:00:00Z")});
  const key="fictional-age-proof-secret-1234567890", prior=process.env.RECEPTIONIST_INVITATION_PRIVATE_AGE_PROOF_KEY;
  process.env.RECEPTIONIST_INVITATION_PRIVATE_AGE_PROOF_KEY=key;
  t.after(()=>{if(prior===undefined)delete process.env.RECEPTIONIST_INVITATION_PRIVATE_AGE_PROOF_KEY;else process.env.RECEPTIONIST_INVITATION_PRIVATE_AGE_PROOF_KEY=prior;});
  const input={requestKey:"fixture-preview-12345",email:"parent@example.test",childName:"Alex",childAge:"8",customerPhone:"864-555-0100",
    balloonColors:"Blue",tableClothColors:"Silver",partyTheme:"Space",partyDate:"2026-11-21",partyTime:"2:00 PM - 3:30 PM",chooseArtworkOnPage:true};
  const proof={callId:"call_fixture",callRevision:4,expiresAt:Date.now()+60_000};
  const material=JSON.stringify(["facility-private-age-v1",input.requestKey,input.email,input.childName,input.childAge,input.customerPhone,
    input.balloonColors,input.tableClothColors,input.partyTheme,input.partyDate,input.partyTime,proof.callId,proof.callRevision,proof.expiresAt]);
  const signature=createHmac("sha256",key).update(material).digest("hex");
  const body={...input,privateAgeProof:{...proof,signature}};
  const parsed=parsePreview(body);
  assert.equal(parsed?.childAge,"8");assert.equal(parsed?.confirmedTheme,null);
  assert.doesNotMatch(JSON.stringify(parsed),/privateAgeProof|call_fixture|signature|Birthdate/);
  for(const changed of [{partyDate:"2026-11-20"},{childAge:"9"},{email:"other@example.test"},{requestKey:"other-preview-12345"}])
    assert.equal(parsePreview({...body,...changed}),null);
  assert.equal(parsePreview({...body,privateAgeProof:{...body.privateAgeProof,callRevision:5}}),null);
  assert.equal(parsePreview({...body,privateAgeProof:{...body.privateAgeProof,expiresAt:Date.now()-1}}),null);
  assert.equal(parsePreview({...body,privateAgeProof:{...body.privateAgeProof,signature:"0".repeat(64)}}),null);
  assert.equal(parsePreview({...body,privateAgeProof:{...body.privateAgeProof,callId:"another_call"}}),null);
  assert.equal(parsePreview({...body,childBirthdate:"2018-11-18"}),null);
  assert.equal(parsePreview({...input}),null);
  delete process.env.RECEPTIONIST_INVITATION_PRIVATE_AGE_PROOF_KEY;
  assert.equal(parsePreview(body),null);
  assert.equal(parsePreview({...input,childAge:"",childBirthdate:"2018-11-18"})?.childAge,"8");
});
