import { listPrivateSlotDispositions, listPublicSaturdaySlotDispositions } from "../facility-parties/availability";
import { isFacilityBookingYmdWithinHorizon } from "../facility-parties/booking-horizon";
import { priceFacilityPartyWithConfig, type FacilityPricingConfig } from "../facility-parties/pricing";
import { resolveFacilityAddons } from "../facility-parties/addons";
import type { FacilityRoomId, PrivateDurationMinutes } from "../facility-parties/types";
import { verifiedFacilityPricing } from "./facility-pricing";
import { isDeepStrictEqual } from "node:util";
import { facilityLocalDateTimeToUtc } from "../facility-parties/zoned-time";

export class FacilityQuoteInputError extends Error {}
const invalid=():never=>{throw new FacilityQuoteInputError("Choose a valid facility party, date, time, duration and add-ons.");};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);

/** Price the exact site-supported option; this never checks availability or books. */
export function quoteFacilityParty(input: unknown, savedSettings: unknown, now = new Date()) {
  if(!object(input))return invalid();
  if(Object.keys(input).sort().join(",")!=="addons,date,durationMinutes,kind,room,schemaVersion,startMinutes"||input.schemaVersion!==1)return invalid();
  const {kind,room,date,startMinutes,durationMinutes,addons}=input;
  if((kind!=="public"&&kind!=="private")||(room!=="room-10"&&room!=="room-20")||
    !isFacilityBookingYmdWithinHorizon(date,now)||!Number.isInteger(startMinutes)||typeof startMinutes!=="number"||startMinutes<0||
    !Number.isInteger(durationMinutes)||typeof durationMinutes!=="number"||![90,120,180].includes(durationMinutes)||startMinutes+durationMinutes>1440||
    kind==="public"&&durationMinutes!==90||kind==="private"&&room!=="room-20"||!object(addons)||
    Object.keys(addons).sort().join(",")!=="cottonCandyPackage,customBirthdayBalloons,goodieBagsQuantity"||
    typeof addons.customBirthdayBalloons!=="boolean"||!Number.isInteger(addons.goodieBagsQuantity)||typeof addons.goodieBagsQuantity!=="number"||addons.goodieBagsQuantity<0||addons.goodieBagsQuantity>100||
    !["none","10_kids","20_kids"].includes(String(addons.cottonCandyPackage)))return invalid();
  const slots=kind==="public"?listPublicSaturdaySlotDispositions(date as string,room as FacilityRoomId,[]):listPrivateSlotDispositions(date as string,durationMinutes as PrivateDurationMinutes,[]);
  if(!slots.some(slot=>slot.startMinutes===startMinutes&&slot.endMinutes===startMinutes+durationMinutes))invalid();
  const start=facilityLocalDateTimeToUtc(date as string,startMinutes),end=facilityLocalDateTimeToUtc(date as string,startMinutes+durationMinutes);
  if(!start||!end||start.getTime()<=now.getTime()||(end.getTime()-start.getTime())/60000!==durationMinutes)invalid();
  const selections={customBirthdayBalloons:addons.customBirthdayBalloons as boolean,goodieBagsQuantity:addons.goodieBagsQuantity as number,cottonCandyPackage:addons.cottonCandyPackage as string};
  const resolved=resolveFacilityAddons(selections),pricing:FacilityPricingConfig=verifiedFacilityPricing(savedSettings);
  const result=priceFacilityPartyWithConfig({partyKind:kind as "public"|"private",roomId:room as FacilityRoomId,date:date as string,durationMinutes,addonSubtotal:resolved.subtotal},pricing);
  if(result.missingPrice)invalid();
  return {schemaVersion:1,kind,room,date,startMinutes,endMinutes:startMinutes+durationMinutes,durationMinutes,addons:resolved.selections,
    packagePrice:result.packagePrice,addonSubtotal:result.addonSubtotal,subtotal:result.subtotal,tax:result.tax,total:result.total,taxRate:result.taxRate,
    availability:"not-checked",finalReviewRequired:true};
}

// A future write adapter must reconcile its idempotency key before rejecting a
// changed quote; this comparison alone does not establish submission safety.
export function matchesConfirmedFacilityQuote(confirmed: unknown, input: unknown, savedSettings: unknown, now = new Date()): boolean {
  try { return isDeepStrictEqual(confirmed,quoteFacilityParty(input,savedSettings,now)); }
  catch { return false; }
}
