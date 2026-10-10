import assert from "node:assert/strict";
import test from "node:test";
import { checkInPayment } from "./EditCheckInDialog";
import type { DeskPerson, DeskTicket } from "@/lib/open-play/desk";
const person: DeskPerson={id:"person",source:"legacy_smartwaiver",business_day_ymd:"2026-10-10",participant_id:null,legacy_participant_id:"legacy",identity_key:"qa",first_name:"QA",last_name:"Guest",role:"child",dob:"2018-01-01",waiver_expires_on:"2029-10-10",checked_in_at:"2026-10-10T14:00:00Z",checked_out_at:null,created_by_staff_id:"staff"};
test("an older paid check-in opens with its saved method and payment amount",()=>{
 const result=checkInPayment({...person,prior_payment:{cash:700,card:0}});
 assert.equal(result.method,"cash");assert.equal(result.amount,700);assert.equal(result.label,"cash");
});
test("corrected payment supersedes prior legacy money in the editor",()=>{
 const ticket:DeskTicket={id:"ticket",business_day_ymd:"2026-10-10",payer_name:"",created_at:person.checked_in_at,created_by_staff_id:"staff",
  items:[{id:"item",ticket_id:"ticket",attendance_id:person.id,classification:"child_3_plus",amount_cents:1000,credited_cents:0,reason:""}],
  payments:[{id:"receipt",ticket_id:"ticket",item_id:"item",method:"card",amount_cents:1000,reference:"",created_at:person.checked_in_at,created_by_staff_id:"staff"}]};
 const result=checkInPayment({...person,prior_payment:{cash:700,card:0},corrected_at:"2026-10-10T15:00:00Z",corrected_method:"card"},ticket);
 assert.equal(result.method,"card");assert.equal(result.amount,1000);
});
