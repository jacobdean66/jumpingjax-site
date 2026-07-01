create table if not exists public.social_publication_schedule_intents (
  schedule_entry_id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null,
  intent_type text not null
    check (intent_type in (
      'publication_intent'
    )),
  state text not null
    check (state in (
      'draft',
      'active',
      'paused',
      'completed',
      'cancelled'
    )),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  intended_publish_at timestamptz not null,
  read_context jsonb null
    check (read_context is null or jsonb_typeof(read_context) = 'object'),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'owner',
      'admin',
      'system',
      'operator'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_scheduler_domain',
      'manual_admin',
      'test'
    )),
  intent_only boolean not null default true
    check (intent_only = true),
  immutable boolean not null default true
    check (immutable = true),
  grants_publishing_permission boolean not null default false
    check (grants_publishing_permission = false),
  approves_nothing boolean not null default true
    check (approves_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  schedules_intent_only boolean not null default true
    check (schedules_intent_only = true),
  mutates_ledger boolean not null default false
    check (mutates_ledger = false),
  mutates_approval boolean not null default false
    check (mutates_approval = false),
  mutates_manifest boolean not null default false
    check (mutates_manifest = false),
  mutates_targets boolean not null default false
    check (mutates_targets = false),
  records_no_metrics boolean not null default true
    check (records_no_metrics = true),
  performs_no_learning boolean not null default true
    check (performs_no_learning = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_schedule_intents_identity_separated
    check (schedule_entry_id <> schedule_id),
  constraint social_publication_schedule_intents_scope_identity_separated
    check (
      schedule_entry_id::text <> social_post_id::text
      and schedule_entry_id::text <> publication_target_id::text
      and schedule_id::text <> social_post_id::text
      and schedule_id::text <> publication_target_id::text
      and (publication_manifest_id is null or schedule_entry_id::text <> publication_manifest_id)
      and (publication_manifest_id is null or schedule_id::text <> publication_manifest_id)
    ),
  constraint social_publication_schedule_intents_read_context_safe
    check (
      read_context is null
      or (
        read_context ->> 'containsLowerLayerPayload' = 'false'
        and read_context ->> 'containsSecrets' = 'false'
        and read_context ->> 'containsExecutionPlan' = 'false'
        and read_context ->> 'readsOnly' = 'true'
      )
    ),
  constraint social_publication_schedule_intents_idempotency_unique
    unique (idempotency_key)
);

create index if not exists social_publication_schedule_intents_schedule_recorded_idx
  on public.social_publication_schedule_intents (schedule_id, recorded_at desc);

create index if not exists social_publication_schedule_intents_post_recorded_idx
  on public.social_publication_schedule_intents (social_post_id, recorded_at desc);

create index if not exists social_publication_schedule_intents_target_recorded_idx
  on public.social_publication_schedule_intents (publication_target_id, recorded_at desc);

create index if not exists social_publication_schedule_intents_state_publish_idx
  on public.social_publication_schedule_intents (state, intended_publish_at asc);

create index if not exists social_publication_schedule_intents_approval_idx
  on public.social_publication_schedule_intents (approval_id, recorded_at desc)
  where approval_id is not null;

create or replace function public.prevent_social_publication_schedule_intent_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_schedule_intents are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_schedule_intent_updates
  on public.social_publication_schedule_intents;
create trigger prevent_social_publication_schedule_intent_updates
  before update on public.social_publication_schedule_intents
  for each row
  execute function public.prevent_social_publication_schedule_intent_changes();

drop trigger if exists prevent_social_publication_schedule_intent_deletes
  on public.social_publication_schedule_intents;
create trigger prevent_social_publication_schedule_intent_deletes
  before delete on public.social_publication_schedule_intents
  for each row
  execute function public.prevent_social_publication_schedule_intent_changes();

alter table public.social_publication_schedule_intents enable row level security;

drop policy if exists "No public social publication schedule intents access"
  on public.social_publication_schedule_intents;
create policy "No public social publication schedule intents access"
  on public.social_publication_schedule_intents
  for all
  to anon, authenticated
  using (false)
  with check (false);
