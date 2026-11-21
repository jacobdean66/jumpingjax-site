import test from "node:test";
import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
import {sendDurableBookingEmail} from "./durable-email";

test("resend transport makes only one attempt after uncertain provider failure and rejects a changed saved payload",async t=>{
  const previous=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY="fixture-only";
  t.after(()=>{if(previous===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous;});
  t.mock.method(console,"error",()=>{});
  let row:Record<string,unknown>|undefined,attempts=0;
  t.mock.method(globalThis,"fetch",async(source:string|Request,init?:RequestInit)=>{
    const req=new Request(source,init),url=new URL(req.url);
    if(url.hostname==="api.resend.com"){attempts++;return Response.json({name:"internal_server_error"},{status:500});}
    assert.equal(url.hostname,"resend-fixture.supabase.co");
    if(req.method==="POST"){row??={...await req.json(),status:"pending",attempt_count:0};return new Response(null,{status:201});}
    if(req.method==="PATCH"){Object.assign(row!,await req.json());return new Response(null,{status:204});}
    return Response.json(row);
  });
  const input={supabase:createClient("https://resend-fixture.supabase.co","fixture",{auth:{persistSession:false}}),messageKey:"receptionist-facility-resend:fixture",kind:"facility" as const,bookingId:"fixture",purpose:"initial_customer_receipt",to:"alex@example.test",subject:"Original",text:"Original message",singleAttempt:true,requireExactPayload:true};
  const result=await sendDurableBookingEmail(input);assert.ok(result.error);assert.equal(attempts,1);
  const conflict=await sendDurableBookingEmail({...input,text:"Changed message"});assert.equal(conflict.error?.code,"outbox_payload_conflict");assert.equal(attempts,1);
});
