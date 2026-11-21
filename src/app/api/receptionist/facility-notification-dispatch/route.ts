import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { dispatchOneFacilityNotification } from "@/lib/receptionist/facility-notification-dispatch";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(req:Request) {
  const key=process.env.RECEPTIONIST_FACILITY_NOTIFICATION_KEY;
  if(process.env.RECEPTIONIST_FACILITY_NOTIFICATION_ENABLED!=="true"||!key||key.length<32||key.length>256||!/^[\x21-\x7e]+$/.test(key))
    return Response.json({state:"disabled"},{status:503,headers:{"Cache-Control":"no-store"}});
  const auth=req.headers.get("authorization")??"", supplied=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!supplied||supplied.length>256||!timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(key).digest()))
    return Response.json({state:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
  // Do not consume a queue claim when there is no mail transport configured.
  if(!process.env.RESEND_API_KEY?.trim())
    return Response.json({state:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  try {
    const result=await dispatchOneFacilityNotification(createServiceRoleClient(),true);
    return Response.json(result,{status:result.state==="unavailable"?503:200,headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({state:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
