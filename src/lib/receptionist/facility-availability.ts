import { FACILITY_PARTY_BUFFER_MINUTES } from "../facility-parties/constants";
import { facilityLocalDateTimeToUtc } from "../facility-parties/zoned-time";
import { validAvailabilityRows } from "../facility-parties/availability-response";
import { FacilityQuoteInputError, quoteFacilityParty } from "./facility-quote";
import type { ReceptionistFacilityPricing } from "./facility-pricing";

type Range = { startBefore: string; endAfter: string };

/** A bounded conflict check, never a reservation or a guarantee. */
export async function checkFacilityAvailability(input: unknown, pricing: ReceptionistFacilityPricing, load: (range: Range) => Promise<unknown>, now = new Date()) {
  const quote=quoteFacilityParty(input,pricing,now);
  const start=facilityLocalDateTimeToUtc(quote.date as string,quote.startMinutes);
  const end=facilityLocalDateTimeToUtc(quote.date as string,quote.endMinutes);
  if(!start||!end||(end.getTime()-start.getTime())/60000!==quote.durationMinutes)throw new FacilityQuoteInputError("Invalid facility booking window.");
  const buffer=FACILITY_PARTY_BUFFER_MINUTES*60000;
  const bufferedStart=start.getTime()-buffer,bufferedEnd=end.getTime()+buffer;
  const rows=await load({startBefore:new Date(bufferedEnd).toISOString(),endAfter:new Date(bufferedStart).toISOString()});
  // A possibly truncated or malformed result cannot establish availability.
  if(!validAvailabilityRows(rows)||rows.length>=1000)throw new Error("Facility availability unavailable");
  const conflict=rows.some(item=>{
    const row=item as Record<string,unknown>,begin=Date.parse(row.start_time as string),finish=Date.parse(row.end_time as string);
    if(!(begin<bufferedEnd&&finish>bufferedStart))return false;
    if(quote.kind==="private"||row.party_kind==="private")return true;
    return row.room===quote.room&&begin<end.getTime()&&finish>start.getTime();
  });
  return {schemaVersion:1,quote,availability:conflict?"unavailable":"open-for-review",bookingGuaranteed:false,finalReviewRequired:true};
}
