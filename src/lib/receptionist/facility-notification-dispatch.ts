import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { getFacilityOwnerEmails } from "@/lib/email/resend";
import { buildHostGuestListUrl } from "@/lib/facility-parties/host-guest-list";
import { facilityConfirmLink, resolveRentalEmailSiteUrl } from "@/lib/rentals/rental-site-url";
import { buildFacilityNotification } from "./facility-notification-message";
import { processOneFacilityNotification, type FacilityNotificationClaim } from "./facility-notification-worker";

// Isolate background failures from the already-committed booking response.
export function scheduleFacilityNotifications(bookingId:string,schedule:(work:()=>Promise<void>)=>void,dispatch:(target:{bookingId:string;kind:"customer"|"owner"})=>Promise<unknown>) {
  try {schedule(async()=>{
    for(const kind of ["customer","owner"] as const) {
      try {await dispatch({bookingId,kind});} catch { /* Leave the queue to review. */ }
    }
  });} catch { /* No background context: both messages remain queued. */ }
}

// A queue claim is single-use; a lost send response is marked unknown, never
// automatically retried. The existing durable email outbox also freezes the
// payload and uses a stable provider idempotency key for each recipient.
export async function dispatchOneFacilityNotification(supabase:SupabaseClient, enabled:boolean, sender=sendDurableBookingEmail, target?:{bookingId:string;kind:"customer"|"owner"}) {
  return processOneFacilityNotification({
    enabled,
    claim:async()=>{
      const {data,error}=await supabase.rpc("claim_receptionist_facility_notification_v1",target?{p_booking_id:target.bookingId,p_kind:target.kind}:{});
      if(error||!Array.isArray(data)||data.length>1)throw new Error("Claim unavailable");
      return data[0]??null;
    },
    prepare:async(claim:FacilityNotificationClaim)=>{
      const [booking,snapshot]=await Promise.all([
        supabase.from("facility_bookings").select("*").eq("id",claim.booking_id).single(),
        supabase.from("receptionist_facility_confirmation_snapshots").select("*").eq("booking_id",claim.booking_id).single(),
      ]);
      if(booking.error||snapshot.error||!booking.data||!snapshot.data)throw new Error("Booking unavailable");
      const message=buildFacilityNotification(claim,booking.data,snapshot.data,getFacilityOwnerEmails());
      const site=resolveRentalEmailSiteUrl();
      if(claim.kind==="customer") {
        const host=buildHostGuestListUrl(site,claim.booking_id);
        message.text+=`\n\nView your party guest list: ${host}\nKeep this host link for yourself.`;
      } else {
        const confirm=facilityConfirmLink(site,claim.booking_id,"confirm"),reject=facilityConfirmLink(site,claim.booking_id,"reject");
        message.text+=`\n\nReview and confirm: ${confirm}\nReview and reject: ${reject}`;
      }
      return message;
    },
    send:async(message,key)=>{
      const match=/^receptionist-facility:([0-9a-f-]{36}):(owner|customer)$/i.exec(key);
      if(!match)throw new Error("Invalid message key");
      for(let i=0;i<message.to.length;i++) {
        const result=await sender({supabase,messageKey:`${key}:${i}`,kind:"facility",bookingId:match[1],
          purpose:match[2]==="customer"?"initial_customer_receipt":"owner_notification",to:message.to[i],subject:message.subject,text:message.text});
        if(result.error)throw new Error("Transport outcome unavailable");
      }
      return {accepted:true};
    },
    finish:async(claim,outcome,errorClass)=>{
      const {data,error}=await supabase.rpc("finish_receptionist_facility_notification_v1",{
        p_booking_id:claim.booking_id,p_kind:claim.kind,p_execution_token:claim.execution_token,p_outcome:outcome,p_error_class:errorClass,
      });
      if(error||typeof data!=="string")throw new Error("Outcome unavailable");
      return data;
    },
  });
}
