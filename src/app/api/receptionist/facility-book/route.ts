import { createHash, timingSafeEqual } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { submitFacilityBooking } from "@/lib/receptionist/facility-book";
import { checkFacilityAvailability } from "@/lib/receptionist/facility-availability";
import { loadSavedFacilitySettingsForWrite } from "@/lib/receptionist/facility-pricing-storage";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FACILITY_POLICY_DIGEST } from "@/lib/receptionist/facility-policy-version";
import { after } from "next/server";
import { dispatchOneFacilityNotification, scheduleFacilityNotifications } from "@/lib/receptionist/facility-notification-dispatch";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
const respond=(status:number,code:string)=>Response.json({ok:false,code},{status,headers});

export async function POST(req:Request) {
  const configured=process.env.RECEPTIONIST_FACILITY_API_KEY;
  if(process.env.RECEPTIONIST_FACILITY_WRITE_ENABLED!=="true"||!configured||configured.length<32||configured.length>256||!/^[\x21-\x7e]+$/.test(configured))return respond(503,"FACILITY_DISABLED");
  const authorization=req.headers.get("authorization")??"";
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!supplied||supplied.length>256||!timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(configured).digest()))return respond(401,"FACILITY_UNAUTHORIZED");
  const limited=rateLimit(req,{scope:"receptionist-facility-book",limit:60,windowMs:60_000});if(limited)return limited;
  if(req.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase()!=="application/json")return respond(415,"FACILITY_INPUT_REJECTED");
  let input:unknown;
  try {
    const declared=Number(req.headers.get("content-length")??"0");if(Number.isFinite(declared)&&declared>32_768)return respond(413,"FACILITY_INPUT_REJECTED");
    const reader=req.body?.getReader();if(!reader)return respond(400,"FACILITY_INPUT_REJECTED");
    const decoder=new TextDecoder("utf-8",{fatal:true});let raw="",size=0;
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>32_768){await reader.cancel();return respond(413,"FACILITY_INPUT_REJECTED");}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
    input=JSON.parse(raw);
  } catch {return respond(400,"FACILITY_INPUT_REJECTED");}
  const result=await submitFacilityBooking(input,{
    lookup:async(request,key)=>{const {data,error}=await createServiceRoleClient().rpc("lookup_receptionist_facility_booking_v3",{p_request:request,p_request_key:key});if(error||data!==null&&typeof data!=="string")throw new Error("Unavailable");return data;},
    settings:loadSavedFacilitySettingsForWrite,
    availability:async(selection,settings,now)=>checkFacilityAvailability(selection,settings,async range=>{
      const {data,error,count}=await createServiceRoleClient().from("facility_bookings").select("id,party_kind,room,start_time,end_time,status",{count:"exact"})
        .in("status",["pending","confirmed"]).lt("start_time",range.startBefore).gt("end_time",range.endAfter).limit(1000);
      if(error||!Array.isArray(data)||count===null||count!==data.length)throw new Error("Unavailable");return data;
    },now),
    create:async(request,booking,key,version)=>{const {data,error}=await createServiceRoleClient().rpc("create_receptionist_facility_booking_guarded_v4",{p_request:request,p_booking:booking,p_request_key:key,p_settings_version:version,p_policy_digest:FACILITY_POLICY_DIGEST});if(error||typeof data!=="string")throw new Error("Unavailable");return data;},
  });
  // A successful receipt is returned immediately; notification failures can
  // never turn a committed booking into a retryable booking request.
  if(result.status===200&&result.body.ok===true&&typeof result.body.id==="string"&&
      process.env.RECEPTIONIST_FACILITY_NOTIFICATION_ENABLED==="true"&&process.env.RESEND_API_KEY?.trim()) {
    scheduleFacilityNotifications(result.body.id,after,target=>dispatchOneFacilityNotification(createServiceRoleClient(),true,undefined,target));
  }
  return Response.json(result.body,{status:result.status,headers});
}
