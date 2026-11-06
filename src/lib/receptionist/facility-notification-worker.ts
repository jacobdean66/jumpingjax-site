/** Single-item delivery coordinator. It has no network, scheduler or transport
 * implementation of its own. The caller must supply trusted database-backed
 * preparation and an explicitly configured transport. `sent` means accepted by
 * that transport, not delivered to an inbox. */
type Kind="owner"|"customer";
export type FacilityNotificationClaim={booking_id:string;kind:Kind;execution_token:string;attempt:number;message_key:string};
export type FacilityNotificationMessage={to:string[];subject:string;text:string};
type Outcome="sent"|"unknown"|"not_attempted";
type Dependencies={
  enabled:boolean;
  claim:()=>Promise<unknown>;
  // This must read the claimed booking and its immutable confirmed snapshot;
  // recipient addresses must come from that booking or trusted owner config.
  prepare:(claim:FacilityNotificationClaim)=>Promise<unknown>;
  send:(message:FacilityNotificationMessage,messageKey:string)=>Promise<unknown>;
  finish:(claim:FacilityNotificationClaim,outcome:Outcome,errorClass:string|null)=>Promise<unknown>;
};
const uuid=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
function validClaim(value:unknown):value is FacilityNotificationClaim {
  if(!plain(value)||Object.keys(value).sort().join(",")!=="attempt,booking_id,execution_token,kind,message_key"||!uuid(value.booking_id)||!uuid(value.execution_token)||
    !["owner","customer"].includes(String(value.kind))||!Number.isSafeInteger(value.attempt)||Number(value.attempt)<1||Number(value.attempt)>100000)return false;
  return value.message_key===`receptionist-facility:${value.booking_id}:${value.kind}`;
}
function validMessage(value:unknown):value is FacilityNotificationMessage {
  if(!plain(value)||Object.keys(value).sort().join(",")!=="subject,text,to"||!Array.isArray(value.to)||value.to.length<1||value.to.length>8||
    value.to.some(email=>typeof email!=="string"||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||new Set(value.to.map(email=>email.toLowerCase())).size!==value.to.length||
    typeof value.subject!=="string"||!value.subject.trim()||value.subject.length>200||/[\u0000-\u001f\u007f]/.test(value.subject)||
    typeof value.text!=="string"||!value.text.trim()||value.text.length>16000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.text))return false;
  return true;
}

export async function processOneFacilityNotification(deps:Dependencies):Promise<{state:string}> {
  if(deps.enabled!==true)return {state:"disabled"};
  let claimed:unknown;
  try {claimed=await deps.claim();} catch {return {state:"unavailable"};}
  if(claimed===null)return {state:"idle"};
  // A malformed or missing token must not initiate a send or a state change;
  // the database lease will later become unknown for staff review.
  if(!validClaim(claimed))return {state:"unknown"};
  const finish=async(outcome:Outcome,error:string|null,expected:string)=>{
    try {return await deps.finish(claimed,outcome,error)===expected?{state:expected}:{state:"unknown"};}
    catch {return {state:"unknown"};}
  };
  let message:unknown;
  try {message=await deps.prepare(claimed);} catch {return finish("unknown","booking_unavailable","unknown");}
  if(!validMessage(message))return finish("unknown","booking_unavailable","unknown");
  let response:unknown;
  try {response=await deps.send(message,claimed.message_key);} catch {return finish("unknown","transport_unknown","unknown");}
  if(!plain(response)||Object.keys(response).join(",")!=="accepted"||response.accepted!==true)return finish("unknown","provider_unknown","unknown");
  return finish("sent",null,"sent");
}
