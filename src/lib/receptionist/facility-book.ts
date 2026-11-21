import { isDeepStrictEqual } from "node:util";
import { facilityAddonsForStorage, resolveFacilityAddons } from "../facility-parties/addons";
import { CHILD_GENDER_CHOICES, FACILITY_DRINK_CHOICES, PAYMENT_METHOD_CHOICES } from "../facility-parties/booking-choices";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "../facility-parties/booking-terms";
import { formatMinutesLabel } from "../facility-parties/time";
import { facilityLocalDateTimeToUtc } from "../facility-parties/zoned-time";
import { quoteFacilityParty } from "./facility-quote";
import type { ReceptionistFacilityPricing } from "./facility-pricing";

type Dict = Record<string, unknown>;
type Availability = {quote: unknown; availability: string};
export type FacilityBookingDependencies = {
  lookup: (request: Dict, key: string) => Promise<string | null>;
  settings: () => Promise<{value:ReceptionistFacilityPricing;version:string}>;
  availability: (selection: unknown, settings: ReceptionistFacilityPricing, now: Date) => Promise<Availability>;
  create: (request: Dict, booking: Dict, key: string, settingsVersion:string) => Promise<string>;
  now?: () => Date;
};
type Result = {status:number; body:Dict};
const object=(v:unknown):v is Dict=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Dict=>object(v)&&Object.keys(v).sort().join(",")===[...keys].sort().join(",");
const id=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const text=(v:unknown,max:number,empty=false):v is string=>typeof v==="string"&&v.length<=max&&v===v.trim()&&(empty||v.length>0)&&!/[\u0000-\u001f\u007f]/.test(v);
const failure=(status:number,code:string):Result=>({status,body:{ok:false,code}});
const success=(idValue:string):Result=>({status:200,body:{ok:true,status:"pending",id:idValue}});

/** This service must run behind authenticated transport. It never sends email. */
export async function submitFacilityBooking(input:unknown,deps:FacilityBookingDependencies):Promise<Result> {
  // Only the stable envelope is validated before reconciliation. The original
  // request, not a newly mapped row, identifies the previously accepted work.
  if(!object(input)||input.schemaVersion!==1||!id(input.idempotencyKey))return failure(400,"FACILITY_INPUT_REJECTED");
  const key=input.idempotencyKey;
  let existing:string|null;
  try {existing=await deps.lookup(input,key);}
  catch {return failure(503,"FACILITY_STATUS_UNKNOWN");}
  if(existing!==null)return id(existing)?success(existing):failure(503,"FACILITY_STATUS_UNKNOWN");
  if(!exact(input,["schemaVersion","idempotencyKey","details","selection","confirmedQuote","confirmedTerms","depositAcknowledged"])||input.depositAcknowledged!==true)return failure(400,"FACILITY_INPUT_REJECTED");
  const d=input.details;
  if(!exact(d,["customerName","email","phone","childName","childGender","childAge","drinkChoice","paymentMethod","partyTheme","balloonColors","tableClothColors","notes"])||
    !text(d.customerName,120)||!text(d.email,254)||!/^\S+@[^\s@]+\.[^\s@]+$/.test(d.email)||
    !text(d.phone,16)||!/^\+?\d{10,15}$/.test(d.phone)||!text(d.childName,120)||!text(d.childAge,120)||!/^(?:[0-9]|1[0-9]|2[0-5])$/.test(d.childAge)||
    !text(d.childGender,120)||!text(d.drinkChoice,120)||!text(d.paymentMethod,120)||
    !text(d.partyTheme,120,true)||!text(d.balloonColors,120,true)||!text(d.tableClothColors,120,true)||!text(d.notes,1000,true))return failure(400,"FACILITY_INPUT_REJECTED");
  const options={genders:CHILD_GENDER_CHOICES,drinks:FACILITY_DRINK_CHOICES,paymentMethods:PAYMENT_METHOD_CHOICES};
  if(!options.genders.includes(d.childGender as typeof options.genders[number])||!options.drinks.includes(d.drinkChoice as typeof options.drinks[number])||!options.paymentMethods.includes(d.paymentMethod as typeof options.paymentMethods[number]))return failure(409,"FACILITY_OPTIONS_CHANGED");
  let settings:ReceptionistFacilityPricing,settingsVersion:string,availability:Availability,quote:ReturnType<typeof quoteFacilityParty>;
  try {
    const snapshot=await deps.settings();settings=snapshot.value;settingsVersion=snapshot.version;
    if(typeof settingsVersion!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(settingsVersion))throw new Error("Unavailable");
    const now=deps.now?.()??new Date();
    quote=quoteFacilityParty(input.selection,settings,now);
    if(!isDeepStrictEqual(input.confirmedQuote,quote))return failure(409,"FACILITY_QUOTE_CHANGED");
    if(!isDeepStrictEqual(input.confirmedTerms,{schemaVersion:1,depositCents:FACILITY_DEPOSIT_CENTS,dueDescription:FACILITY_DEPOSIT_DUE,balanceDescription:FACILITY_BALANCE_DUE}))return failure(409,"FACILITY_TERMS_CHANGED");
    availability=await deps.availability(input.selection,settings,now);
    if(!isDeepStrictEqual(availability.quote,quote))return failure(503,"FACILITY_CONFIG_UNAVAILABLE");
    if(availability.availability==="unavailable")return failure(409,"FACILITY_SLOT_UNAVAILABLE");
    if(availability.availability!=="open-for-review")return failure(503,"FACILITY_CONFIG_UNAVAILABLE");
  } catch {return failure(503,"FACILITY_CONFIG_UNAVAILABLE");}
  const start=facilityLocalDateTimeToUtc(quote.date as string,quote.startMinutes),end=facilityLocalDateTimeToUtc(quote.date as string,quote.endMinutes);
  if(!start||!end)return failure(503,"FACILITY_CONFIG_UNAVAILABLE");
  const addons=resolveFacilityAddons(quote.addons);
  const booking:Dict={party_kind:quote.kind,room:quote.room,start_time:start.toISOString(),end_time:end.toISOString(),
    customer_name:d.customerName,email:d.email,phone:d.phone,parent_name:d.customerName,child_name:d.childName,child_gender:d.childGender,child_age:d.childAge,
    party_theme:d.partyTheme,balloon_colors:d.balloonColors,table_cloth_colors:d.tableClothColors,drink_choice:d.drinkChoice,payment_method:d.paymentMethod,
    deposit_acknowledged:true,notes:d.notes,readable_date:quote.date,readable_time:`${formatMinutesLabel(quote.startMinutes)} - ${formatMinutesLabel(quote.endMinutes)}`,
    party_label:quote.kind==="private"?"Private Party":"Public Play Party",addon_selections:facilityAddonsForStorage(addons),facility_package_price:quote.packagePrice,
    addon_subtotal:quote.addonSubtotal,subtotal:quote.subtotal,tax:quote.tax,total:quote.total,pricing_details:{taxRate:quote.taxRate,source:"facility-party-price-sheet"}};
  try {const created=await deps.create(input,booking,key,settingsVersion);return id(created)?success(created):failure(503,"FACILITY_STATUS_UNKNOWN");}
  catch {return failure(503,"FACILITY_STATUS_UNKNOWN");}
}
