create table if not exists public.social_publication_execution_intents (
  execution_intent_id uuid primary key default gen_random_uuid(),
  execution_job_id uuid not null unique default gen_random_uuid(),
  intent_type text not null
    check (intent_type in (
      'prepare_execution_intent'
    )),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publisher_request_id uuid null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  publisher_job_id uuid null
    references public.social_publication_publisher_requests(publisher_job_id) on delete restrict,
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  metric_observation_id uuid null
    references public.social_publication_metric_observations(metric_observation_id) on delete restrict,
  learning_insight_id uuid null,
  campaign_memory_id uuid null
    references public.social_campaign_memories(id) on delete restrict,
  decision_history_id uuid null
    references public.social_post_decisions(id) on delete restrict,
  owner_approval_satisfied boolean not null default false,
  publisher_authority_satisfied boolean not null default false,
  preflight_id uuid null,
  preflight_status text null
    check (preflight_status is null or preflight_status in (
      'not_run',
      'passed',
      'blocked',
      'failed'
    )),
  preflight_block_reasons text[] not null default '{}'::text[]
    check (
      preflight_block_reasons <@ array[
        'missing_owner_approval',
        'missing_publisher_request',
        'missing_publisher_result',
        'publisher_result_rejected',
        'missing_schedule_intent',
        'schedule_not_active',
        'schedule_not_due',
        'missing_ledger_entry',
        'missing_publication_manifest',
        'missing_publication_target',
        'authority_insufficient',
        'preflight_not_run',
        'preflight_previously_failed'
      ]::text[]
    ),
  preflight_evaluated_at timestamptz null,
  evidence_id uuid null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'model',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_execution_domain',
      'manual_admin',
      'test'
    )),
  contract_only boolean not null default true
    check (contract_only = true),
  model_authority_only boolean not null default true
    check (model_authority_only = true),
  references_only boolean not null default true
    check (references_only = true),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),
  calls_no_external_apis boolean not null default true
    check (calls_no_external_apis = true),
  uses_no_sdks boolean not null default true
    check (uses_no_sdks = true),
  uses_no_network boolean not null default true
    check (uses_no_network = true),
  starts_no_workers boolean not null default true
    check (starts_no_workers = true),
  starts_no_timers boolean not null default true
    check (starts_no_timers = true),
  creates_no_queues boolean not null default true
    check (creates_no_queues = true),
  exposes_no_api_routes boolean not null default true
    check (exposes_no_api_routes = true),
  exposes_no_admin_ui boolean not null default true
    check (exposes_no_admin_ui = true),
  mutates_no_sql boolean not null default true
    check (mutates_no_sql = true),
  mutates_no_storage boolean not null default true
    check (mutates_no_storage = true),
  mutates_no_lower_layers boolean not null default true
    check (mutates_no_lower_layers = true),
  records_no_metrics boolean not null default true
    check (records_no_metrics = true),
  performs_no_learning boolean not null default true
    check (performs_no_learning = true),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_execution_intents_identity_separated
    check (
      execution_intent_id <> execution_job_id
      and execution_intent_id::text <> social_post_id::text
      and execution_intent_id::text <> publication_target_id::text
      and execution_job_id::text <> social_post_id::text
      and execution_job_id::text <> publication_target_id::text
    ),
  constraint social_publication_execution_intents_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_execution_intents_job_scope_unique
    unique (execution_intent_id, execution_job_id)
);

create table if not exists public.social_publication_execution_results (
  execution_result_id uuid primary key default gen_random_uuid(),
  execution_intent_id uuid not null
    references public.social_publication_execution_intents(execution_intent_id) on delete restrict,
  execution_job_id uuid not null,
  result_type text not null
    check (result_type in (
      'execution_result_recorded'
    )),
  result_status text not null
    check (result_status in ('blocked', 'failed', 'completed')),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publisher_request_id uuid null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  publisher_job_id uuid null
    references public.social_publication_publisher_requests(publisher_job_id) on delete restrict,
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  metric_observation_id uuid null
    references public.social_publication_metric_observations(metric_observation_id) on delete restrict,
  learning_insight_id uuid null,
  campaign_memory_id uuid null
    references public.social_campaign_memories(id) on delete restrict,
  decision_history_id uuid null
    references public.social_post_decisions(id) on delete restrict,
  block_reasons text[] not null default '{}'::text[]
    check (
      block_reasons <@ array[
        'missing_owner_approval',
        'missing_publisher_request',
        'missing_publisher_result',
        'publisher_result_rejected',
        'missing_schedule_intent',
        'schedule_not_active',
        'schedule_not_due',
        'missing_ledger_entry',
        'missing_publication_manifest',
        'missing_publication_target',
        'authority_insufficient',
        'preflight_not_run',
        'preflight_previously_failed'
      ]::text[]
    ),
  evidence_id uuid null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'model',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_execution_domain',
      'manual_admin',
      'test'
    )),
  contract_only boolean not null default true
    check (contract_only = true),
  model_authority_only boolean not null default true
    check (model_authority_only = true),
  references_only boolean not null default true
    check (references_only = true),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),
  calls_no_external_apis boolean not null default true
    check (calls_no_external_apis = true),
  uses_no_sdks boolean not null default true
    check (uses_no_sdks = true),
  uses_no_network boolean not null default true
    check (uses_no_network = true),
  persists_nothing boolean not null default true
    check (persists_nothing = true),
  mutates_no_lower_layers boolean not null default true
    check (mutates_no_lower_layers = true),
  current_execution_status_authority boolean not null default false
    check (current_execution_status_authority = false),
  records_no_metrics boolean not null default true
    check (records_no_metrics = true),
  performs_no_learning boolean not null default true
    check (performs_no_learning = true),
  grants_execution_permission boolean not null default false
    check (grants_execution_permission = false),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_execution_results_identity_separated
    check (
      execution_result_id <> execution_intent_id
      and execution_result_id <> execution_job_id
      and execution_result_id::text <> social_post_id::text
      and execution_result_id::text <> publication_target_id::text
    ),
  constraint social_publication_execution_results_completed_requires_evidence
    check (
      result_status not in ('blocked', 'failed')
      or evidence_id is not null
    ),
  constraint social_publication_execution_results_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_execution_results_intent_job_scope_fk
    foreign key (execution_intent_id, execution_job_id)
    references public.social_publication_execution_intents (execution_intent_id, execution_job_id)
    on delete restrict
);

create table if not exists public.social_publication_execution_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  execution_intent_id uuid not null
    references public.social_publication_execution_intents(execution_intent_id) on delete restrict,
  execution_result_id uuid null
    references public.social_publication_execution_results(execution_result_id) on delete restrict,
  evidence_kind text not null
    check (evidence_kind in (
      'preflight_evidence',
      'authority_evidence',
      'operator_note',
      'none'
    )),
  notes text null
    check (notes is null or length(trim(notes)) > 0),
  evidence jsonb not null
    check (jsonb_typeof(evidence) = 'object'),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publisher_request_id uuid null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  publisher_job_id uuid null
    references public.social_publication_publisher_requests(publisher_job_id) on delete restrict,
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  metric_observation_id uuid null
    references public.social_publication_metric_observations(metric_observation_id) on delete restrict,
  learning_insight_id uuid null,
  campaign_memory_id uuid null
    references public.social_campaign_memories(id) on delete restrict,
  decision_history_id uuid null
    references public.social_post_decisions(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'model',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_execution_domain',
      'manual_admin',
      'test'
    )),
  contains_full_payload boolean not null default false
    check (contains_full_payload = false),
  contains_secrets boolean not null default false
    check (contains_secrets = false),
  proves_execution boolean not null default false
    check (proves_execution = false),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_execution_evidence_identity_separated
    check (
      evidence_id <> execution_intent_id
      and (execution_result_id is null or evidence_id <> execution_result_id)
      and evidence_id::text <> social_post_id::text
      and evidence_id::text <> publication_target_id::text
    ),
  constraint social_publication_execution_evidence_summary_safe
    check (
      evidence ->> 'containsFullPayload' is distinct from 'true'
      and evidence ->> 'containsSecrets' is distinct from 'true'
      and evidence ->> 'provesExecution' is distinct from 'true'
    ),
  constraint social_publication_execution_evidence_idempotency_unique
    unique (idempotency_key)
);

create index if not exists social_publication_execution_intents_post_requested_idx
  on public.social_publication_execution_intents (social_post_id, requested_at desc);

create index if not exists social_publication_execution_intents_target_requested_idx
  on public.social_publication_execution_intents (publication_target_id, requested_at desc);

create index if not exists social_publication_execution_intents_manifest_idx
  on public.social_publication_execution_intents (publication_manifest_id, requested_at desc)
  where publication_manifest_id is not null;

create index if not exists social_publication_execution_intents_schedule_idx
  on public.social_publication_execution_intents (schedule_id, requested_at desc)
  where schedule_id is not null;

create index if not exists social_publication_execution_intents_ledger_idx
  on public.social_publication_execution_intents (ledger_entry_id, requested_at desc)
  where ledger_entry_id is not null;

create index if not exists social_publication_execution_intents_approval_idx
  on public.social_publication_execution_intents (approval_id, requested_at desc)
  where approval_id is not null;

create index if not exists social_publication_execution_intents_publisher_request_idx
  on public.social_publication_execution_intents (publisher_request_id, requested_at desc)
  where publisher_request_id is not null;

create index if not exists social_publication_execution_results_intent_recorded_idx
  on public.social_publication_execution_results (execution_intent_id, recorded_at desc);

create index if not exists social_publication_execution_results_post_recorded_idx
  on public.social_publication_execution_results (social_post_id, recorded_at desc);

create index if not exists social_publication_execution_results_target_recorded_idx
  on public.social_publication_execution_results (publication_target_id, recorded_at desc);

create index if not exists social_publication_execution_results_status_recorded_idx
  on public.social_publication_execution_results (result_status, recorded_at desc);

create index if not exists social_publication_execution_evidence_intent_recorded_idx
  on public.social_publication_execution_evidence (execution_intent_id, recorded_at desc);

create index if not exists social_publication_execution_evidence_result_recorded_idx
  on public.social_publication_execution_evidence (execution_result_id, recorded_at desc)
  where execution_result_id is not null;

create index if not exists social_publication_execution_evidence_post_recorded_idx
  on public.social_publication_execution_evidence (social_post_id, recorded_at desc);

create or replace function public.validate_social_publication_execution_result_scope()
returns trigger
language plpgsql
as $$
declare
  parent_intent record;
begin
  select
    social_post_id,
    publication_target_id,
    publisher_request_id,
    publisher_result_id,
    publisher_job_id,
    schedule_id,
    ledger_entry_id,
    publication_manifest_id,
    owner_approval_id,
    approval_id,
    metric_observation_id,
    learning_insight_id,
    campaign_memory_id,
    decision_history_id
  into parent_intent
  from public.social_publication_execution_intents
  where execution_intent_id = new.execution_intent_id;

  if not found then
    raise exception 'execution result parent intent is missing';
  end if;

  if parent_intent.social_post_id <> new.social_post_id
    or parent_intent.publication_target_id <> new.publication_target_id
    or parent_intent.publisher_request_id is distinct from new.publisher_request_id
    or parent_intent.publisher_result_id is distinct from new.publisher_result_id
    or parent_intent.publisher_job_id is distinct from new.publisher_job_id
    or parent_intent.schedule_id is distinct from new.schedule_id
    or parent_intent.ledger_entry_id is distinct from new.ledger_entry_id
    or parent_intent.publication_manifest_id is distinct from new.publication_manifest_id
    or parent_intent.owner_approval_id is distinct from new.owner_approval_id
    or parent_intent.approval_id is distinct from new.approval_id
    or parent_intent.metric_observation_id is distinct from new.metric_observation_id
    or parent_intent.learning_insight_id is distinct from new.learning_insight_id
    or parent_intent.campaign_memory_id is distinct from new.campaign_memory_id
    or parent_intent.decision_history_id is distinct from new.decision_history_id
  then
    raise exception 'execution result scope must match parent intent scope';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_execution_result_scope_insert
  on public.social_publication_execution_results;
create trigger validate_social_publication_execution_result_scope_insert
  before insert on public.social_publication_execution_results
  for each row
  execute function public.validate_social_publication_execution_result_scope();

create or replace function public.validate_social_publication_execution_evidence_scope()
returns trigger
language plpgsql
as $$
declare
  parent_intent record;
  parent_result record;
begin
  select
    social_post_id,
    publication_target_id,
    publisher_request_id,
    publisher_result_id,
    publisher_job_id,
    schedule_id,
    ledger_entry_id,
    publication_manifest_id,
    owner_approval_id,
    approval_id,
    metric_observation_id,
    learning_insight_id,
    campaign_memory_id,
    decision_history_id
  into parent_intent
  from public.social_publication_execution_intents
  where execution_intent_id = new.execution_intent_id;

  if not found then
    raise exception 'execution evidence parent intent is missing';
  end if;

  if parent_intent.social_post_id <> new.social_post_id
    or parent_intent.publication_target_id <> new.publication_target_id
    or parent_intent.publisher_request_id is distinct from new.publisher_request_id
    or parent_intent.publisher_result_id is distinct from new.publisher_result_id
    or parent_intent.publisher_job_id is distinct from new.publisher_job_id
    or parent_intent.schedule_id is distinct from new.schedule_id
    or parent_intent.ledger_entry_id is distinct from new.ledger_entry_id
    or parent_intent.publication_manifest_id is distinct from new.publication_manifest_id
    or parent_intent.owner_approval_id is distinct from new.owner_approval_id
    or parent_intent.approval_id is distinct from new.approval_id
    or parent_intent.metric_observation_id is distinct from new.metric_observation_id
    or parent_intent.learning_insight_id is distinct from new.learning_insight_id
    or parent_intent.campaign_memory_id is distinct from new.campaign_memory_id
    or parent_intent.decision_history_id is distinct from new.decision_history_id
  then
    raise exception 'execution evidence scope must match parent intent scope';
  end if;

  if new.execution_result_id is not null then
    select execution_intent_id
    into parent_result
    from public.social_publication_execution_results
    where execution_result_id = new.execution_result_id;

    if not found then
      raise exception 'execution evidence parent result is missing';
    end if;

    if parent_result.execution_intent_id <> new.execution_intent_id then
      raise exception 'execution evidence result must belong to the same intent';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_execution_evidence_scope_insert
  on public.social_publication_execution_evidence;
create trigger validate_social_publication_execution_evidence_scope_insert
  before insert on public.social_publication_execution_evidence
  for each row
  execute function public.validate_social_publication_execution_evidence_scope();

create or replace function public.prevent_social_publication_execution_intent_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_execution_intents are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_execution_intent_updates
  on public.social_publication_execution_intents;
create trigger prevent_social_publication_execution_intent_updates
  before update on public.social_publication_execution_intents
  for each row
  execute function public.prevent_social_publication_execution_intent_changes();

drop trigger if exists prevent_social_publication_execution_intent_deletes
  on public.social_publication_execution_intents;
create trigger prevent_social_publication_execution_intent_deletes
  before delete on public.social_publication_execution_intents
  for each row
  execute function public.prevent_social_publication_execution_intent_changes();

create or replace function public.prevent_social_publication_execution_result_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_execution_results are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_execution_result_updates
  on public.social_publication_execution_results;
create trigger prevent_social_publication_execution_result_updates
  before update on public.social_publication_execution_results
  for each row
  execute function public.prevent_social_publication_execution_result_changes();

drop trigger if exists prevent_social_publication_execution_result_deletes
  on public.social_publication_execution_results;
create trigger prevent_social_publication_execution_result_deletes
  before delete on public.social_publication_execution_results
  for each row
  execute function public.prevent_social_publication_execution_result_changes();

create or replace function public.prevent_social_publication_execution_evidence_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_execution_evidence is append-only';
end;
$$;

drop trigger if exists prevent_social_publication_execution_evidence_updates
  on public.social_publication_execution_evidence;
create trigger prevent_social_publication_execution_evidence_updates
  before update on public.social_publication_execution_evidence
  for each row
  execute function public.prevent_social_publication_execution_evidence_changes();

drop trigger if exists prevent_social_publication_execution_evidence_deletes
  on public.social_publication_execution_evidence;
create trigger prevent_social_publication_execution_evidence_deletes
  before delete on public.social_publication_execution_evidence
  for each row
  execute function public.prevent_social_publication_execution_evidence_changes();

alter table public.social_publication_execution_intents enable row level security;
alter table public.social_publication_execution_results enable row level security;
alter table public.social_publication_execution_evidence enable row level security;

drop policy if exists "No public social publication execution intents access"
  on public.social_publication_execution_intents;
create policy "No public social publication execution intents access"
  on public.social_publication_execution_intents
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication execution results access"
  on public.social_publication_execution_results;
create policy "No public social publication execution results access"
  on public.social_publication_execution_results
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication execution evidence access"
  on public.social_publication_execution_evidence;
create policy "No public social publication execution evidence access"
  on public.social_publication_execution_evidence
  for all
  to anon, authenticated
  using (false)
  with check (false);
