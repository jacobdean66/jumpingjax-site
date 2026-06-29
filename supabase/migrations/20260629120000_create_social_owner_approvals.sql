create table if not exists public.social_owner_approval_proposals (
  proposal_id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique default gen_random_uuid(),
  social_post_id uuid not null
    references public.social_posts(id) on delete cascade,
  proposal_fingerprint text not null,
  proposal_version text not null,
  proposal_scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(proposal_scope) = 'object'),
  snapshot jsonb not null
    check (jsonb_typeof(snapshot) = 'object'),
  requested_readiness_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requested_readiness_summary) = 'object'),
  created_by_actor jsonb not null
    check (jsonb_typeof(created_by_actor) = 'object'),
  created_at timestamptz not null default now(),
  request_metadata jsonb null
    check (request_metadata is null or jsonb_typeof(request_metadata) = 'object'),

  constraint social_owner_approval_proposals_identity_unique
    unique (social_post_id, proposal_fingerprint, proposal_version)
);

create index if not exists social_owner_approval_proposals_post_created_idx
  on public.social_owner_approval_proposals (social_post_id, created_at desc);

create index if not exists social_owner_approval_proposals_fingerprint_idx
  on public.social_owner_approval_proposals (proposal_fingerprint);

create table if not exists public.social_owner_approval_events (
  event_id uuid primary key default gen_random_uuid(),
  approval_id uuid not null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid not null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  proposal_fingerprint text not null,
  event_type text not null
    check (event_type in (
      'approval_requested',
      'approval_approved',
      'approval_rejected',
      'approval_revoked',
      'approval_expired',
      'approval_superseded'
    )),
  actor_snapshot jsonb not null
    check (jsonb_typeof(actor_snapshot) = 'object'),
  event_reason text null,
  occurred_at timestamptz not null default now(),
  event_sequence integer not null
    check (event_sequence > 0),
  event_metadata jsonb null
    check (event_metadata is null or jsonb_typeof(event_metadata) = 'object'),

  constraint social_owner_approval_events_order_unique
    unique (approval_id, event_sequence)
);

create index if not exists social_owner_approval_events_approval_order_idx
  on public.social_owner_approval_events (approval_id, event_sequence asc);

create index if not exists social_owner_approval_events_proposal_order_idx
  on public.social_owner_approval_events (proposal_id, event_sequence asc);

create index if not exists social_owner_approval_events_type_occurred_idx
  on public.social_owner_approval_events (event_type, occurred_at desc);

create or replace function public.prevent_social_owner_approval_proposal_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_owner_approval_proposals are immutable';
end;
$$;

drop trigger if exists prevent_social_owner_approval_proposal_updates
  on public.social_owner_approval_proposals;
create trigger prevent_social_owner_approval_proposal_updates
  before update on public.social_owner_approval_proposals
  for each row
  execute function public.prevent_social_owner_approval_proposal_changes();

drop trigger if exists prevent_social_owner_approval_proposal_deletes
  on public.social_owner_approval_proposals;
create trigger prevent_social_owner_approval_proposal_deletes
  before delete on public.social_owner_approval_proposals
  for each row
  execute function public.prevent_social_owner_approval_proposal_changes();

create or replace function public.prevent_social_owner_approval_event_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_owner_approval_events are append-only';
end;
$$;

drop trigger if exists prevent_social_owner_approval_event_updates
  on public.social_owner_approval_events;
create trigger prevent_social_owner_approval_event_updates
  before update on public.social_owner_approval_events
  for each row
  execute function public.prevent_social_owner_approval_event_changes();

drop trigger if exists prevent_social_owner_approval_event_deletes
  on public.social_owner_approval_events;
create trigger prevent_social_owner_approval_event_deletes
  before delete on public.social_owner_approval_events
  for each row
  execute function public.prevent_social_owner_approval_event_changes();

alter table public.social_owner_approval_proposals enable row level security;
alter table public.social_owner_approval_events enable row level security;

drop policy if exists "No public social owner approval proposals access"
  on public.social_owner_approval_proposals;
create policy "No public social owner approval proposals access"
  on public.social_owner_approval_proposals
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social owner approval events access"
  on public.social_owner_approval_events;
create policy "No public social owner approval events access"
  on public.social_owner_approval_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
