import {createHash,timingSafeEqual} from "node:crypto";
import {rateLimit} from "@/lib/rate-limit";
import {createServiceRoleClient} from "@/lib/supabase/admin";
import {sendDurableBookingEmail} from "@/lib/bookings/durable-email";
import {resendFacilityReceipt} from "@/lib/receptionist/facility-receipt-resend";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
const unavailable=()=>Response.json({status:"staff-follow-up-required"},{status:503,headers});
export async function POST(request:Request) {
  const key=process.env.RECEPTIONIST_FACILITY_RESEND_KEY;
  if(process.env.RECEPTIONIST_FACILITY_RESEND_ENABLED!=="true"||!key||key.length<32||key.length>256||!/^[\x21-\x7e]+$/.test(key))return unavailable();
  const auth=request.headers.get("authorization")??"",supplied=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!supplied||supplied.length>256||!timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(key).digest()))
    return Response.json({status:"staff-follow-up-required"},{status:401,headers});
  const limited=rateLimit(request,{scope:"receptionist-facility-receipt-resend",limit:30,windowMs:60_000});if(limited)return limited;
  if(!process.env.RESEND_API_KEY?.trim()||request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase()!=="application/json")return unavailable();
  let input:unknown;
  try {
    if(Number(request.headers.get("content-length")??"0")>4096)throw Error();
    const reader=request.body?.getReader();if(!reader)throw Error();
    let size=0,body="";const decoder=new TextDecoder("utf-8",{fatal:true});
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error();}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}
    input=JSON.parse(body);
  }catch{return unavailable();}
  try {
    const db=createServiceRoleClient();
    const result=await resendFacilityReceipt(input,{
      claim:async r=>{const {data,error}=await db.rpc("claim_receptionist_facility_receipt_resend_v1",{p_booking_id:r.bookingId,p_operation_id:r.operationId,p_expected_email:r.expectedEmail,p_call_id:r.callId,p_review_turn_id:r.reviewTurnId,p_affirmation_turn_id:r.affirmationTurnId});if(error)throw Error();return data;},
      send:async (original,r)=>{const sent=await sendDurableBookingEmail({supabase:db,messageKey:`receptionist-facility-resend:${r.bookingId}`,kind:"facility",bookingId:r.bookingId,purpose:"initial_customer_receipt",to:original.recipient,subject:original.subject,text:original.body,...(original.html?{html:original.html}:{}),singleAttempt:true,requireExactPayload:true});return !sent.error;},
      finish:async(r,accepted)=>{const {data,error}=await db.rpc("finish_receptionist_facility_receipt_resend_v1",{p_booking_id:r.bookingId,p_operation_id:r.operationId,p_accepted:accepted});return !error&&data===true;},
    });
    return Response.json(result,{status:result.status==="provider-accepted"?200:503,headers});
  }catch{return unavailable();}
}
