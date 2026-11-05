import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindApprovedFacilityPreview } from "./invitations/preview-binding";

test("approved previews bind the chosen invitation to fictional 10 and 20 kid bookings", async (t) => {
  const previousPricingSource = process.env.FACILITY_PRICING_DATABASE_ENABLED;
  process.env.FACILITY_PRICING_DATABASE_ENABLED = "true";
  t.after(() => {
    if (previousPricingSource === undefined) delete process.env.FACILITY_PRICING_DATABASE_ENABLED;
    else process.env.FACILITY_PRICING_DATABASE_ENABLED = previousPricingSource;
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-04T15:00:00Z") });
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table booking_integration_workflows (
        booking_kind text not null, booking_id text not null,
        operator_required boolean not null default false, last_error_class text,
        initial_customer_email_status text not null default 'pending',
        owner_notification_status text not null default 'pending',
        unique (booking_kind, booking_id)
      );
      create table facility_bookings (
        id uuid primary key default gen_random_uuid(),
        party_kind text, room text, start_time timestamptz, end_time timestamptz,
        customer_name text, email text, phone text, parent_name text, child_name text,
        child_gender text, child_age text, party_theme text, balloon_colors text,
        table_cloth_colors text, drink_choice text, payment_method text,
        deposit_acknowledged boolean, notes text, readable_date text, readable_time text,
        party_label text, addon_selections jsonb, facility_package_price numeric,
        addon_subtotal numeric, subtotal numeric, tax numeric, total numeric,
        pricing_details jsonb, status text, idempotency_key text unique,
        invitation_delivery_preference text not null default 'print'
          check (invitation_delivery_preference ~ '^(print|email|office_pickup)(,(print|email|office_pickup))*$'),
        invitation_template_id text default 'spotlight' check (invitation_template_id in ('spotlight','ticket','poster')),
        invitation_quantity integer not null default 4 check (invitation_quantity in (4,8,12,16,20,24,28))
      );
      grant select, update on facility_bookings to service_role;
      grant select, insert on booking_integration_workflows to service_role;
    `);
    for (const name of [
      "20260930002000_repair_facility_invitation_persistence.sql",
      "20261104200000_facility_invitation_previews.sql",
      "20261104210000_bind_facility_invitation_preview.sql",
      "20261104220000_preview_artwork_search.sql",
      "20261104223000_facility_pricing_revision.sql",
      "20261105021500_facility_preview_selection_revision.sql",
      "20261105021600_guard_preview_booking_revisions.sql",
    ]) {
      await db.exec(await readFile(new URL("../../../supabase/migrations/" + name, import.meta.url), "utf8"));
    }

    const theme = { id:"space",label:"Space",description:"Space",originalQuery:"Space",
      imageUrl:"https://example.com/image.png",sourceUrl:"https://example.com/source",
      imagePath:"/api/facility/invitations/artwork/"+"a".repeat(64),confirmedAt:"2026-11-04T14:00:00Z" };
    const pricing = {publicRoom10:140,publicRoom20Weekday:215,publicRoom20Weekend:240,
      privateWeekday90:270,privateWeekday120:305,privateWeekend90:270,privateWeekend120:305,privateAny180:450,taxRate:0.07};
    await db.query("insert into facility_pricing_settings (pricing) values ($1)", [JSON.stringify(pricing)]);
    // Supabase's network layer and artwork storage are fictional.
    // The adapter, pricing, and both booking SQL functions use real source.
    const supabase = {
      from(table: string) { return { select: () => ({ eq: (column: string, value: string | boolean) => ({ maybeSingle: async () => {
        assert.match(table, /^(facility_invitation_previews|facility_bookings|facility_pricing_settings)$/);
        assert.match(column, /^(id|singleton)$/);
        const fields = table === "facility_pricing_settings" ? "pricing,revision::double precision as revision" : "*";
        const result = await db.query(`select ${fields} from ${table} where ${column}=$1`, [value]);
        return {data:result.rows[0] ? JSON.parse(JSON.stringify(result.rows[0])) : null,error:null};
      } }) }) }; },
      storage: {from() { return {download: async () => ({
        data: new Blob([Buffer.from("89504e470d0a1a0a","hex")]), error: null,
      })}; }},
      rpc: async (name: string,args: {p_preview_id:string;p_request_key:string;p_booking:unknown;p_pricing_revision:number|null;p_selection_revision:number}) => {
        assert.equal(name,"bind_facility_invitation_preview_atomic");
        try {const result=await db.query<{id:string}>("select public.bind_facility_invitation_preview_atomic($1,$2,$3,$4,$5) as id",[args.p_preview_id,args.p_request_key,JSON.stringify(args.p_booking),args.p_pricing_revision,args.p_selection_revision]);return {data:result.rows[0].id,error:null};}
        catch(error) {return {data:null,error:{message:String(error)}};}
      },
    } as unknown as SupabaseClient;
    for (const [room,total,packagePrice,key] of [["room-10",149.8,140,"fictional-preview-10"],["room-20",256.8,240,"fictional-preview-20"]] as const) {
      const inserted=await db.query<{id:string}>(`insert into facility_invitation_previews
        (request_key,payload_hash,recipient,child_name,child_age,customer_phone,balloon_colors,table_cloth_colors,
         party_theme,party_date,party_time,confirmed_theme,status,selected_option_index,delivery_preferences,invitation_quantity,selection_revision)
        values ($1,'fixture','parent@example.test','Alex','8','864-555-0100','Blue','Silver',
          'Space','2026-11-21','2:00 PM - 3:30 PM',$2,'accepted',1,array['email','print'],20,1) returning id`,[key,JSON.stringify(theme)]);
      const previewId=inserted.rows[0].id;
      const result=await bindApprovedFacilityPreview(supabase,{
        previewId,requestKey:key+"-booking",customerName:"Fixture Parent",email:"parent@example.test",phone:"864-555-0100",
        room,date:"2026-11-21",startMinutes:840,selectionRevision:1,optionIndex:1,deliveryPreferences:["email","print"],quantity:20,depositAcknowledged:true,
        childGender:"Girl",drinkChoice:"Capri-Sun",paymentMethod:"Cash",notes:"",addons:{customBirthdayBalloons:false,goodieBagsQuantity:0,cottonCandyPackage:"none"},
        pricingRevision:1,
        quote:{packagePrice,addonSubtotal:0,subtotal:packagePrice,tax:Math.round((total-packagePrice)*100)/100,total,taxRate:0.07},
      });
      const saved=await db.query<{room:string;invitation: {optionIndex:number};invitation_delivery_preference:string;invitation_quantity:number;booking_id:string}>(
        "select b.room,b.invitation,b.invitation_delivery_preference,b.invitation_quantity,p.booking_id from facility_bookings b join facility_invitation_previews p on p.booking_id=b.id where p.id=$1",[previewId]);
      assert.equal(saved.rows[0].room,room);assert.equal(saved.rows[0].invitation.optionIndex,1);
      assert.equal(saved.rows[0].invitation_delivery_preference,"email,print");assert.equal(saved.rows[0].invitation_quantity,20);
      assert.equal(saved.rows[0].booking_id,result.bookingId);
    }
  } finally {await db.close();}
});
