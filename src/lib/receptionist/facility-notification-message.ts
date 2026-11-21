import {isDeepStrictEqual} from "node:util";
import {facilityLocalDateTimeToUtc} from "../facility-parties/zoned-time";
import {formatMinutesLabel} from "../facility-parties/time";
import type {FacilityNotificationClaim,FacilityNotificationMessage} from "./facility-notification-worker";

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const text=(value:unknown,max:number,empty=false):value is string=>typeof value==="string"&&value.length<=max&&value===value.trim()&&(empty||value.length>0)&&!/[\u0000-\u001f\u007f]/.test(value);
const numeric=(value:unknown):number|null=>{
  if(typeof value!=="number"&&(typeof value!=="string"||!/^\d+(?:\.\d{1,2})?$/.test(value)))return null;
  const amount=Number(value);return Number.isFinite(amount)&&amount>=0&&amount<=1_000_000&&Math.abs(Math.round(amount*100)-amount*100)<0.000001?amount:null;
};
const usd=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
const sentence=(value:string)=>/[.!?]$/.test(value)?value:`${value}.`;

/** Build a notice only from the claimed database booking and its immutable
 * confirmation snapshot. This is not a sender and makes no delivery claim. */
export function buildFacilityNotification(claim:FacilityNotificationClaim,booking:unknown,snapshot:unknown,ownerRecipients:string[]):FacilityNotificationMessage {
  if(!object(booking)||!object(snapshot)||booking.id!==claim.booking_id||snapshot.booking_id!==claim.booking_id||booking.status!=="pending"||
    !object(snapshot.confirmed_quote)||!object(snapshot.confirmed_terms)||!object(snapshot.selection)||!object(snapshot.confirmed_details))throw new Error("Booking unavailable");
  const q=snapshot.confirmed_quote,t=snapshot.confirmed_terms,s=snapshot.selection,d=snapshot.confirmed_details;
  if(q.schemaVersion!==1||t.schemaVersion!==1||s.schemaVersion!==1||!text(s.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||
    !Number.isInteger(s.startMinutes)||typeof s.startMinutes!=="number"||s.startMinutes<0||!Number.isInteger(s.durationMinutes)||typeof s.durationMinutes!=="number"||![90,120,180].includes(s.durationMinutes)||s.startMinutes+s.durationMinutes>1440||
    !["public","private"].includes(String(s.kind))||!["room-10","room-20"].includes(String(s.room))||
    q.kind!==s.kind||q.room!==s.room||q.date!==s.date||q.startMinutes!==s.startMinutes||q.durationMinutes!==s.durationMinutes||q.endMinutes!==s.startMinutes+s.durationMinutes||q.availability!=="not-checked"||q.finalReviewRequired!==true||
    !isDeepStrictEqual(q.addons,s.addons)||!object(booking.addon_selections)||!isDeepStrictEqual(booking.addon_selections.selections,s.addons)||
    booking.party_kind!==s.kind||booking.room!==s.room||booking.readable_date!==s.date||booking.deposit_acknowledged!==true||
    !Number.isSafeInteger(t.depositCents)||Number(t.depositCents)<0||Number(t.depositCents)>100000000||!text(t.dueDescription,1000)||!text(t.balanceDescription,1000))throw new Error("Booking snapshot mismatch");
  const start=facilityLocalDateTimeToUtc(s.date,s.startMinutes),end=facilityLocalDateTimeToUtc(s.date,s.startMinutes+s.durationMinutes);
  if(!start||!end||typeof booking.start_time!=="string"||typeof booking.end_time!=="string"||Date.parse(booking.start_time)!==start.getTime()||Date.parse(booking.end_time)!==end.getTime()||
    booking.readable_time!==`${formatMinutesLabel(s.startMinutes)} - ${formatMinutesLabel(s.startMinutes+s.durationMinutes)}`)throw new Error("Booking time mismatch");
  const amounts=[['facility_package_price','packagePrice'],['addon_subtotal','addonSubtotal'],['subtotal','subtotal'],['tax','tax'],['total','total']] as const;
  for(const [field,confirmed] of amounts){const stored=numeric(booking[field]),original=numeric(q[confirmed]);if(stored===null||original===null||stored!==original)throw new Error("Booking price mismatch");}
  const required=["customer_name","email","phone","child_name","child_gender","child_age","drink_choice","payment_method"] as const;
  for(const field of required)if(!text(booking[field],field==="email"?254:120))throw new Error("Booking details unavailable");
  for(const field of ["party_theme","balloon_colors","table_cloth_colors","notes"] as const)if(!text(booking[field],field==="notes"?1000:120,true))throw new Error("Booking details unavailable");
  const fields={customer_name:"customerName",email:"email",phone:"phone",child_name:"childName",child_gender:"childGender",child_age:"childAge",drink_choice:"drinkChoice",payment_method:"paymentMethod",party_theme:"partyTheme",balloon_colors:"balloonColors",table_cloth_colors:"tableClothColors",notes:"notes"} as const;
  for(const [field,confirmed] of Object.entries(fields))if(booking[field]!==d[confirmed])throw new Error("Booking details changed");
  if(!object(s.addons)||typeof s.addons.customBirthdayBalloons!=="boolean"||!Number.isSafeInteger(s.addons.goodieBagsQuantity)||Number(s.addons.goodieBagsQuantity)<0||Number(s.addons.goodieBagsQuantity)>100||
    !["none","10_kids","20_kids"].includes(String(s.addons.cottonCandyPackage)))throw new Error("Booking add-ons unavailable");
  const total=numeric(q.total),base=numeric(q.packagePrice),addons=numeric(q.addonSubtotal),subtotal=numeric(q.subtotal),tax=numeric(q.tax);
  if(total===null||base===null||addons===null||subtotal===null||tax===null||typeof q.taxRate!=="number"||!Number.isFinite(q.taxRate)||q.taxRate<0||q.taxRate>1||Math.round((base+addons)*100)!==Math.round(subtotal*100)||Math.round(subtotal*q.taxRate*100)!==Math.round(tax*100)||Math.round((subtotal+tax)*100)!==Math.round(total*100))throw new Error("Booking price unavailable");
  const party=s.kind==="private"?"Private facility party":"Public play party";
  const room=s.room==="room-10"?"10 child room":"20 child room";
  const common=[`${party}, ${room}: ${s.date}, ${booking.readable_time}.`,`Estimated total: ${usd(total)}.`,`Deposit terms agreed when requesting: ${usd(Number(t.depositCents)/100)}. ${sentence(t.dueDescription)} ${sentence(t.balanceDescription)}`,
    "This request was pending review when this notice was prepared. This message does not confirm a booking or payment; contact the team for its current status."];
  if(claim.kind==="customer")return {to:[String(booking.email)],subject:"Your Jumping Jax facility party request",text:[`Hello ${booking.customer_name},`,"Jumping Jax received your facility party request.",...common].join("\n")};
  if(claim.kind!=="owner"||!Array.isArray(ownerRecipients)||ownerRecipients.length===0)throw new Error("Owner recipient unavailable");
  const extra=[`Contact: ${booking.customer_name}, ${booking.phone}, ${booking.email}.`,`Child: ${booking.child_name}, age ${booking.child_age}, ${booking.child_gender}.`,
    `Drink: ${booking.drink_choice}. Payment method: ${booking.payment_method}.`,`Birthday balloons: ${s.addons.customBirthdayBalloons?"yes":"no"}. Goodie bags: ${s.addons.goodieBagsQuantity}. Cotton candy: ${String(s.addons.cottonCandyPackage).replaceAll("_"," ")}.`,
    ...([['Theme',booking.party_theme],['Balloon colors',booking.balloon_colors],['Tablecloth colors',booking.table_cloth_colors],['Notes',booking.notes]] as const).filter(([,value])=>value).map(([label,value])=>`${label}: ${value}.`)];
  return {to:[...ownerRecipients],subject:"New Jumping Jax facility party request",text:["A facility party request needs review.",...common,...extra].join("\n")};
}
