import { rateLimit } from "@/lib/rate-limit";
import { checkFacilityAvailability } from "@/lib/receptionist/facility-availability";
import { FacilityQuoteInputError } from "@/lib/receptionist/facility-quote";
import { loadSavedFacilitySettings } from "@/lib/receptionist/facility-pricing-storage";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
const unavailable=()=>Response.json({error:"Facility availability is temporarily unavailable."},{status:503,headers});

// Informational only: no hold, reservation, booking write, or outbound message.
export async function POST(req: Request) {
  const limited=rateLimit(req,{scope:"receptionist-facility-availability",limit:60,windowMs:60_000});if(limited)return limited;
  if(!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return Response.json({error:"JSON required."},{status:415,headers});
  let input:unknown;
  try {
    const length=Number(req.headers.get("content-length")??"0");if(Number.isFinite(length)&&length>4096)return Response.json({error:"Request is too large."},{status:413,headers});
    const reader=req.body?.getReader();if(!reader)throw new Error("Missing body");
    const decoder=new TextDecoder("utf-8",{fatal:true});let bytes=0,raw="";
    try {while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096){await reader.cancel();return Response.json({error:"Request is too large."},{status:413,headers});}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
    input=JSON.parse(raw);
  } catch {return Response.json({error:"Invalid JSON."},{status:400,headers});}
  try {
    const settings=await loadSavedFacilitySettings();
    const result=await checkFacilityAvailability(input,settings,async range=>{
      const {data,error,count}=await createServiceRoleClient().from("facility_bookings").select("id,party_kind,room,start_time,end_time,status",{count:"exact"})
        .in("status",["pending","confirmed"]).lt("start_time",range.startBefore).gt("end_time",range.endAfter).limit(1000);
      if(error||!Array.isArray(data)||count===null||count!==data.length)throw new Error("Unavailable");return data;
    });
    return Response.json(result,{headers});
  } catch(error) {return error instanceof FacilityQuoteInputError?Response.json({error:error.message},{status:400,headers}):unavailable();}
}
