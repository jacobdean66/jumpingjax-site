import { rateLimit } from "@/lib/rate-limit";
import { facilityPricingResponse } from "@/lib/receptionist/facility-pricing";
import { FacilityQuoteInputError, quoteFacilityParty } from "@/lib/receptionist/facility-quote";
import { loadReceptionistFacilityPricing } from "@/lib/receptionist/facility-pricing-storage";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// Public price configuration only; this endpoint does not claim availability or book a party.
export async function GET(req: Request) {
  const limited = rateLimit(req, { scope: "receptionist-facility-pricing", limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  return facilityPricingResponse(loadReceptionistFacilityPricing);
}

// A quote is informational; it does not check availability or submit a booking.
export async function POST(req: Request) {
  const limited = rateLimit(req, { scope: "receptionist-facility-quote", limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "JSON required." }, { status: 415, headers });
  let input: unknown;
  try {
    const length=Number(req.headers.get("content-length")??"0");
    if(Number.isFinite(length)&&length>4096)return Response.json({error:"Request is too large."},{status:413,headers});
    const reader=req.body?.getReader();if(!reader)throw new Error("Missing body");
    const decoder=new TextDecoder("utf-8",{fatal:true});let bytes=0,raw="";
    try {
      while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;
        if(bytes>4096){await reader.cancel();return Response.json({error:"Request is too large."},{status:413,headers});}
        raw+=decoder.decode(value,{stream:true});}
      raw+=decoder.decode();
    } finally {reader.releaseLock();}
    input=JSON.parse(raw);
  } catch {return Response.json({error:"Invalid JSON."},{status:400,headers});}
  try {return Response.json(quoteFacilityParty(input,await loadReceptionistFacilityPricing()),{headers});}
  catch(error) {return error instanceof FacilityQuoteInputError?Response.json({error:error.message},{status:400,headers}):Response.json({error:"Facility pricing is temporarily unavailable."},{status:503,headers});}
}
