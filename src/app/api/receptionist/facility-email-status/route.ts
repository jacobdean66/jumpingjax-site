import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(req:Request) {
  const key=process.env.RECEPTIONIST_FACILITY_STATUS_KEY;
  if(process.env.RECEPTIONIST_FACILITY_STATUS_ENABLED!=="true"||!key||key.length<32||key.length>256||!/^[\x21-\x7e]+$/.test(key))
    return Response.json({status:"unknown"},{status:503,headers});
  const auth=req.headers.get("authorization")??"", supplied=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!supplied||supplied.length>256||!timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(key).digest()))
    return Response.json({status:"unknown"},{status:401,headers});
  const limited=rateLimit(req,{scope:"receptionist-facility-email-status",limit:60,windowMs:60_000});if(limited)return limited;
  let input:unknown;
  try {
    if(Number(req.headers.get("content-length")??"0")>512)throw Error();
    const reader=req.body?.getReader();if(!reader)throw Error();
    const decoder=new TextDecoder("utf-8",{fatal:true});let body="",size=0;
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>512){await reader.cancel();throw Error();}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}
    input=JSON.parse(body);
  }catch{return Response.json({status:"unknown"},{status:400,headers});}
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).join(",")!=="bookingId"||
    typeof (input as {bookingId?:unknown}).bookingId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((input as {bookingId:string}).bookingId))
    return Response.json({status:"unknown"},{status:400,headers});
  try {
    const {data,error}=await createServiceRoleClient().from("receptionist_facility_notifications").select("state")
      .eq("booking_id",(input as {bookingId:string}).bookingId).eq("kind","customer").maybeSingle();
    if(error||!data||!["pending","sending","sent","unknown"].includes(data.state))throw Error();
    // sent means accepted by the mail provider, not delivered to an inbox.
    return Response.json({status:data.state},{headers});
  } catch {return Response.json({status:"unknown"},{status:503,headers});}
}
