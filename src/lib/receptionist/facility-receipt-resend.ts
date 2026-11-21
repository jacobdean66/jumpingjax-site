import { isValidEmailAddress } from "@/lib/email/address";

type Request={bookingId:string;operationId:string;expectedEmail:string;callId:string;reviewTurnId:string;affirmationTurnId:string};
type Original={status:"claimed";recipient:string;subject:string;body:string;html:string|null};
type Dependencies={claim:(request:Request)=>Promise<unknown>;send:(original:Original,request:Request)=>Promise<boolean>;finish:(request:Request,accepted:boolean)=>Promise<boolean>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=/^[A-Za-z0-9_-]{1,80}$/;
const unavailable={status:"staff-follow-up-required"} as const;
const accepted={status:"provider-accepted",delivery:"unconfirmed"} as const;

// The receptionist service attests that the next-turn yes belongs to the same
// successful call action. This service never accepts a destination override.
export async function resendFacilityReceipt(input:unknown,deps:Dependencies) {
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).sort().join(",")!=="affirmationTurnId,bookingId,callId,expectedEmail,operationId,reviewTurnId")return unavailable;
  const request=input as Request;
  if(typeof request.bookingId!=="string"||!uuid.test(request.bookingId)||typeof request.operationId!=="string"||!uuid.test(request.operationId)||
    typeof request.callId!=="string"||!id.test(request.callId)||typeof request.reviewTurnId!=="string"||!id.test(request.reviewTurnId)||typeof request.affirmationTurnId!=="string"||!id.test(request.affirmationTurnId)||
    request.reviewTurnId===request.affirmationTurnId||typeof request.expectedEmail!=="string"||request.expectedEmail.length>254||!isValidEmailAddress(request.expectedEmail))return unavailable;
  try {
    const claim=await deps.claim(request);
    if(!claim||typeof claim!=="object"||Array.isArray(claim))return unavailable;
    if((claim as {status?:unknown}).status==="provider-accepted")return accepted;
    const original=claim as Original;
    if(original.status!=="claimed"||!isValidEmailAddress(original.recipient)||original.recipient.trim().toLowerCase()!==request.expectedEmail.trim().toLowerCase()||
      typeof original.subject!=="string"||!original.subject||original.subject.length>200||typeof original.body!=="string"||!original.body||original.body.length>50000||
      original.html!==null&&(typeof original.html!=="string"||original.html.length>100000))return unavailable;
    let sent=false;try {sent=await deps.send(original,request)===true;}catch{/* Provider outcome is unknown. */}
    const recorded=await deps.finish(request,sent);
    return sent&&recorded?accepted:unavailable;
  } catch{return unavailable;}
}
