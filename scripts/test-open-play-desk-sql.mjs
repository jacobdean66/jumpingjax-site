import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table waiver_submissions(id uuid primary key,status text,expires_on date,signer_first_name text,signer_last_name text);
create table waiver_participants(id uuid primary key,submission_id uuid,first_name text,last_name text,dob date,role text);
create table waiver_participant_name_corrections(id uuid primary key,participant_id uuid,corrected_first_name text,corrected_last_name text,created_at timestamptz default now());
create table smartwaiver_legacy_waivers(id uuid primary key,activated boolean,expires_on date,signer_first_name text,signer_last_name text);
create table smartwaiver_legacy_participants(id uuid primary key,legacy_waiver_id uuid,waiver_id text,first_name text,last_name text,dob date,role text);
create table smartwaiver_legacy_participant_name_corrections(id uuid primary key,legacy_participant_id uuid,corrected_first_name text,corrected_last_name text,created_at timestamptz default now());
create table open_play_visits(id uuid primary key,status text,created_by_staff_id text);
create table open_play_visit_attendees(id uuid primary key,participant_id uuid,visit_id uuid,business_day_ymd text,status text,created_at timestamptz);
create table open_play_payment_entries(attendee_id uuid,amount_cents int);
create table smartwaiver_legacy_visits(id uuid primary key,status text);
create table smartwaiver_legacy_check_ins(id uuid primary key,legacy_participant_id uuid,legacy_visit_id uuid,business_day_ymd text,status text,created_at timestamptz,staff_id text);
create table smartwaiver_legacy_payment_entries(legacy_check_in_id uuid,amount_cents int);
create table open_play_audit_events(actor_staff_id text,action text,entity_type text,entity_id text,detail jsonb);`);
await db.exec('create table facility_bookings(id uuid primary key,start_time timestamptz); create table facility_party_guests(booking_id uuid,waiver_participant_id uuid,checked_in_at timestamptz);');
for (const name of ['20261006193000_open_play_desk_tickets','20261006194000_unified_waiver_name_search','20261006201500_keep_existing_checkins_on_desk']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
}
const day='2026-10-06';
const nativeWaiver=crypto.randomUUID(), legacyWaiver=crypto.randomUUID();
await db.query(`insert into waiver_submissions values($1,'completed','2029-10-06','Jane','Jones')`,[nativeWaiver]);
await db.query(`insert into smartwaiver_legacy_waivers values($1,true,'2029-10-06','John','Smith')`,[legacyWaiver]);
const guests=[];
for(let i=0;i<6;i++){
  const id=crypto.randomUUID(),source=i<3?'native':'legacy_smartwaiver';
  const first=['Casey','Jamie','Riley','Morgan','Avery','Cameron'][i],last=['QA','Quinn','Parker','Lee','White','Green'][i];
  const dob=i===0||i===3?'1990-01-01':i===5?'2024-01-01':'2018-01-01';
  const role=i===0||i===3?'adult_signer':'child';
  if(source==='native') await db.query('insert into waiver_participants values($1,$2,$3,$4,$5,$6)',[id,nativeWaiver,first,last,dob,role]);
  else await db.query('insert into smartwaiver_legacy_participants values($1,$2,$3,$4,$5,$6,$7)',[id,legacyWaiver,'legacy-test',first,last,dob,role]);
  guests.push({source,participantId:id});
}
const command=async(action,payload,date=day)=>(await db.query('select open_play_desk_command($1,$2,$3,$4) result',[date,action,'QA staff',payload])).rows[0].result;
const count=async(table)=>(await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
for(const person of guests){await command('mark_here',person);await command('mark_here',person);}
assert.equal(await count('open_play_desk_attendance'),6);
const oldCallerPerson=crypto.randomUUID(), oldCallerVisit=crypto.randomUUID();
await db.query('insert into waiver_participants values($1,$2,$3,$4,$5,$6)',[oldCallerPerson,nativeWaiver,'Existing','Caller','2019-01-01','child']);
await db.query('insert into open_play_visits values($1,$2,$3)',[oldCallerVisit,'open','QA staff']);
await db.query('insert into open_play_visit_attendees values($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),oldCallerPerson,oldCallerVisit,day,'active',new Date().toISOString()]);
assert.equal(await count('open_play_desk_attendance'),7);
assert.equal(await count('open_play_checkout_payments'),0);
await db.query('delete from open_play_visit_attendees where participant_id=$1',[oldCallerPerson]);
await db.query('delete from open_play_desk_attendance where participant_id=$1',[oldCallerPerson]);
assert.equal(await count('open_play_checkout_payments'),0);
assert.equal(await count('open_play_payment_entries'),0);
const ticketId=crypto.randomUUID();await command('create_ticket',{ticketId});await command('create_ticket',{ticketId});
for(const guest of guests){await command('add',{ticketId,...guest});await command('add',{ticketId,...guest});}
assert.equal(await count('open_play_checkout_items'),6);
assert.equal(await count('open_play_checkout_tickets'),1);
const lines=(await db.query('select * from open_play_checkout_items order by id')).rows;
for(const item of lines){if(!item.classification)await command('edit',{ticketId,itemId:item.id,classification:'playing_adult',amountCents:1000});}
assert.equal((await db.query('select sum(amount_cents)::int total from open_play_checkout_items')).rows[0].total,5700);
const paymentId=crypto.randomUUID();const payment={ticketId,paymentId,method:'card',amountCents:5700,reference:'One group receipt'};
await command('pay',payment);await command('pay',payment);
assert.equal(await count('open_play_checkout_payments'),1);
assert.equal(await count('open_play_desk_attendance'),6);
await assert.rejects(()=>command('pay',{...payment,amountCents:5600}),/retry does not match/);
await assert.rejects(()=>command('pay',{...payment,paymentId:crypto.randomUUID(),amountCents:1}),/cannot exceed/);
await assert.rejects(()=>command('edit',{ticketId,itemId:lines[0].id,classification:'watching_adult',amountCents:0}),/locked/);
const second=crypto.randomUUID();await command('create_ticket',{ticketId:second});
assert.equal((await command('add',{ticketId:second,...guests[0]})).ticketId,ticketId);
assert.equal(await count('open_play_checkout_items'),6);
const presence=(await db.query('select id from open_play_desk_attendance where participant_id=$1',[guests[0].participantId])).rows[0].id;
await command('depart',{attendanceId:presence});
assert.equal((await db.query('select count(*)::int n from open_play_desk_attendance where checked_out_at is null')).rows[0].n,5);
await command('mark_here',guests[0]);assert.equal(await count('open_play_desk_attendance'),6);
await assert.rejects(()=>command('create_ticket',{ticketId},'2026-10-07'),/another day/);
// Full, first, last and partially typed names find the same waiver group.
for(const q of ['J','Jamie','Quinn','Jamie Quinn','  jamie   qui  ','2018']){
  const found=await db.query('select * from search_waiver_participants_for_staff($1,25)',[q]);
  assert.ok(found.rows.some(row=>row.participant_id===guests[1].participantId),q);
}
for(const q of ['Avery','White','Avery White','Avery W'])assert.ok((await db.query('select * from search_smartwaiver_legacy_participants_for_staff($1,25)',[q])).rows.some(row=>row.legacy_participant_id===guests[4].participantId));
await db.query('insert into waiver_participant_name_corrections values($1,$2,$3,$4,now())',[crypto.randomUUID(),guests[1].participantId,'James','Quinn']);
for(const q of ['Jamie Quinn','James Quinn'])assert.ok((await db.query('select * from search_waiver_participants_for_staff($1,25)',[q])).rows.some(row=>row.participant_id===guests[1].participantId));
await command('mark_here',guests[1]);assert.equal(await count('open_play_desk_attendance'),6);
assert.equal((await db.query('select first_name from open_play_desk_attendance where participant_id=$1',[guests[1].participantId])).rows[0].first_name,'James');
// The same identity on an old and new waiver remains one arrival.
const duplicate=crypto.randomUUID();await db.query('insert into smartwaiver_legacy_participants values($1,$2,$3,$4,$5,$6,$7)',[duplicate,legacyWaiver,'duplicate','Riley','Parker','2018-01-01','child']);
await command('mark_here',{source:'legacy_smartwaiver',participantId:duplicate});assert.equal(await count('open_play_desk_attendance'),6);
// Invalid add does not leave half a group or change an existing ticket.
await assert.rejects(()=>command('add',{ticketId:second,source:'native',participantId:crypto.randomUUID()}),/not found/);
assert.equal(await count('open_play_checkout_items'),6);
const privileges=(await db.query(`select has_function_privilege('anon','open_play_desk_command(text,text,text,jsonb)','EXECUTE') allowed`)).rows[0];assert.equal(privileges.allowed,false);
await assert.rejects(()=>db.query('update open_play_checkout_payments set amount_cents=1'),/immutable/);
await assert.rejects(()=>command('void_payment',{ticketId,paymentId,reason:''}),/Enter a reason/);
await command('void_payment',{ticketId,paymentId,reason:'Wrong receipt recorded'});
await command('void_payment',{ticketId,paymentId,reason:'Wrong receipt recorded'});
assert.equal(await count('open_play_checkout_payments'),2);
assert.equal((await db.query('select sum(amount_cents)::int paid from open_play_checkout_payments where ticket_id=$1',[ticketId])).rows[0].paid,0);
assert.equal(await count('open_play_desk_attendance'),6);
console.log('PASS: six mixed-source guests, no-payment arrival, shared receipt, safe retries, full-name search, corrections, departure and access controls');
await db.close();
