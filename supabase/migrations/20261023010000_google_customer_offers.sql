begin;
create table public.google_customer_offers (
 id uuid primary key default gen_random_uuid(),
 code text not null unique default ('JAX-' || upper(replace(gen_random_uuid()::text,'-',''))),
 email text not null check (email = lower(trim(email))),
 kind text not null check(kind in ('rental','facility')),
 campaign text not null default 'google-15',
 created_at timestamptz not null default now(),
 unique(email,kind,campaign)
);
create table public.google_offer_redemptions (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.google_customer_offers(id),
 kind text not null check(kind in ('rental','facility')),
 booking_id text not null,
 request_key text not null,
 discount numeric(12,2) not null check(discount > 0),
 status text not null check(status in ('reserved','redeemed','released')),
 created_at timestamptz not null default now(),
 unique(kind,booking_id), unique(kind,request_key)
);
create unique index google_offer_one_active_booking on public.google_offer_redemptions(offer_id) where status <> 'released';
alter table public.google_customer_offers enable row level security;
alter table public.google_offer_redemptions enable row level security;
revoke all on public.google_customer_offers,public.google_offer_redemptions from public,anon,authenticated;
grant all on public.google_customer_offers,public.google_offer_redemptions to service_role;

create function public.claim_google_customer_offer(p_email text,p_kind text) returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_code text;
begin
 if p_kind not in ('rental','facility') or length(trim(p_email)) not between 3 and 254 or p_email not like '%@%.%' then raise exception 'invalid_offer'; end if;
 insert into public.google_customer_offers(email,kind) values(lower(trim(p_email)),p_kind)
 on conflict(email,kind,campaign) do update set email=excluded.email returning code into v_code;
 return v_code;
end; $$;

create function public.book_with_google_customer_offer(p_kind text,p_code text,p_booking jsonb,p_items jsonb,p_agreement jsonb,p_idempotency_key text,p_discount numeric)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_offer public.google_customer_offers%rowtype; v_existing public.google_offer_redemptions%rowtype; v_id text; v_email text;
begin
 if p_kind not in ('rental','facility') or p_discount is null or p_discount <= 0 then raise exception 'invalid_offer'; end if;
 select * into v_offer from public.google_customer_offers where code=upper(trim(p_code)) for update;
 v_email := case when p_kind='rental' then p_booking->>'customer_email' else p_booking->>'email' end;
 if not found or v_offer.kind is distinct from p_kind or v_offer.email is distinct from lower(trim(v_email)) then raise exception 'invalid_offer'; end if;
 select * into v_existing from public.google_offer_redemptions where offer_id=v_offer.id and status<>'released';
 if found and (v_existing.request_key<>p_idempotency_key or v_existing.kind<>p_kind) then raise exception 'offer_already_used'; end if;
 if found and v_existing.discount<>p_discount then raise exception 'offer_request_conflict'; end if;
 if exists(select 1 from public.google_offer_redemptions where kind=p_kind and request_key=p_idempotency_key and offer_id<>v_offer.id) then raise exception 'offer_request_conflict'; end if;
 if p_kind='rental' then
   v_id := public.create_rental_booking_with_agreement_atomic(p_booking,p_items,p_idempotency_key,p_agreement);
   if not exists(select 1 from public.bookings where id::text=v_id and total=(p_booking->>'total')::numeric and setup_notes=p_booking->>'setup_notes') then raise exception 'offer_request_conflict'; end if;
 else
   v_id := public.create_facility_booking_atomic(p_booking,p_idempotency_key)::text;
   if not exists(select 1 from public.facility_bookings where id::text=v_id and total=(p_booking->>'total')::numeric and notes=p_booking->>'notes') then raise exception 'offer_request_conflict'; end if;
 end if;
 insert into public.google_offer_redemptions(offer_id,kind,booking_id,request_key,discount,status)
 values(v_offer.id,p_kind,v_id,p_idempotency_key,p_discount,'reserved')
 on conflict(kind,booking_id) do nothing;
 return v_id;
end; $$;

create function public.update_google_offer_booking_status() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.google_offer_redemptions set status=case
 when lower(new.status::text) in ('approved','confirmed') then 'redeemed'
 when lower(new.status::text) in ('rejected','cancelled','canceled') then 'released'
 else 'reserved' end
 where booking_id=new.id::text and kind=case when TG_TABLE_NAME='bookings' then 'rental' else 'facility' end;
 return new;
end; $$;
create trigger google_offer_rental_status after update of status on public.bookings for each row execute function public.update_google_offer_booking_status();
create trigger google_offer_facility_status after update of status on public.facility_bookings for each row execute function public.update_google_offer_booking_status();
revoke all on function public.claim_google_customer_offer(text,text), public.book_with_google_customer_offer(text,text,jsonb,jsonb,jsonb,text,numeric),public.update_google_offer_booking_status() from public,anon,authenticated;
grant execute on function public.claim_google_customer_offer(text,text),public.book_with_google_customer_offer(text,text,jsonb,jsonb,jsonb,text,numeric) to service_role;
notify pgrst, 'reload schema';
commit;
