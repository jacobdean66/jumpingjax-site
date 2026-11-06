import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {resendFacilityReceipt} from "./facility-receipt-resend";

test("a saved exact receipt is resent at most once and unknown outcomes cannot replay",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.facility_bookings(id uuid primary key,email text,status text);
      create table public.receptionist_facility_notifications(booking_id uuid,kind text,state text);
      create table public.booking_notification_outbox(message_key text primary key,booking_kind text,booking_id text,purpose text,status text,recipient text,subject text,body text,html_body text);`);
    await db.exec(await readFile(new URL("../../../supabase/migrations/20261106010500_receptionist_facility_receipt_resend.sql",import.meta.url),"utf8"));
    const bookingId="11111111-1111-4111-8111-111111111111",otherId="22222222-2222-4222-8222-222222222222";
    for(const booking of [bookingId,otherId]) {
      await db.query("insert into facility_bookings values ($1,'alex@example.test','pending')",[booking]);
      await db.query("insert into receptionist_facility_notifications values ($1,'customer','sent')",[booking]);
      await db.query("insert into booking_notification_outbox values ($1,'facility',$2,'initial_customer_receipt','sent','alex@example.test','Original subject','Original text',null)",[`receptionist-facility:${booking}:customer:0`,booking]);
    }
    const base={bookingId,operationId:"33333333-3333-4333-8333-333333333333",expectedEmail:"alex@example.test",callId:"call-1",reviewTurnId:"review-1",affirmationTurnId:"yes-1"};
    let sends=0,shouldFail=false;
    const deps={
      claim:async(r:typeof base)=>{const q=await db.query<{result:unknown}>("select public.claim_receptionist_facility_receipt_resend_v1($1,$2,$3,$4,$5,$6) result",[r.bookingId,r.operationId,r.expectedEmail,r.callId,r.reviewTurnId,r.affirmationTurnId]);return q.rows[0].result;},
      send:async(message:{subject:string;body:string;recipient:string})=>{sends++;assert.equal(message.subject,"Original subject");assert.equal(message.body,"Original text");assert.equal(message.recipient,"alex@example.test");if(shouldFail)throw Error("lost response");return true;},
      finish:async(r:typeof base,accepted:boolean)=>{const q=await db.query<{result:boolean}>("select public.finish_receptionist_facility_receipt_resend_v1($1,$2,$3) result",[r.bookingId,r.operationId,accepted]);return q.rows[0].result;},
    };
    const no={status:"staff-follow-up-required"},yes={status:"provider-accepted",delivery:"unconfirmed"};
    assert.deepEqual(await resendFacilityReceipt({...base,expectedEmail:"wrong@example.test"},deps),no);assert.equal(sends,0);
    assert.deepEqual(await resendFacilityReceipt(base,deps),yes);assert.equal(sends,1);
    assert.deepEqual(await resendFacilityReceipt(base,deps),yes);assert.equal(sends,1);
    assert.deepEqual(await resendFacilityReceipt({...base,operationId:"44444444-4444-4444-8444-444444444444"},deps),no);assert.equal(sends,1);
    shouldFail=true;const second={...base,bookingId:otherId,operationId:"55555555-5555-4555-8555-555555555555"};
    assert.deepEqual(await resendFacilityReceipt(second,deps),no);assert.equal(sends,2);
    assert.deepEqual(await resendFacilityReceipt(second,deps),no);
    assert.deepEqual(await resendFacilityReceipt({...second,operationId:"66666666-6666-4666-8666-666666666666"},deps),no);assert.equal(sends,2);
  } finally {await db.close();}
});
