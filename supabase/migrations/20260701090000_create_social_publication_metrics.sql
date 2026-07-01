create table if not exists public.social_publication_metric_observations (
  metric_observation_id uuid primary key default gen_random_uuid(),
  observation_type text not null
    check (observation_type in ('publication_metric_observation')),
  metric_name text not null
    check (metric_name in (
      'impressions',
      'reach',
      'engagements',
      'clicks',
      'shares',
      'comments',
      'reactions'
    )),
  metric_status text not null
    check (metric_status in ('pending', 'completed', 'failed')),
  metric_value numeric null
    check (metric_value is null or metric_value >= 0),
  aggregation_type text not null
    check (aggregation_type in ('sum', 'latest', 'count', 'average')),
  observation_source text not null
    check (observation_source in ('manual_observation', 'imported_report', 'test')),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publisher_request_id uuid null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  publisher_job_id uuid null,
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  evidence_id uuid null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in ('system', 'owner', 'admin', 'analytics', 'test')),
  recorded_source text not null
    check (recorded_source in ('publication_metrics_domain', 'manual_admin', 'test')),
  passive_only boolean not null default true
    check (passive_only = true),
  observation_only boolean not null default true
    check (observation_only = true),
  references_only boolean not null default true
    check (references_only = true),
  contains_platform_payload boolean not null default false
    check (contains_platform_payload = false),
  collects_no_metrics boolean not null default true
    check (collects_no_metrics = true),
  calls_no_external_apis boolean not null default true
    check (calls_no_external_apis = true),
  uses_no_sdks boolean not null default true
    check (uses_no_sdks = true),
  uses_no_network boolean not null default true
    check (uses_no_network = true),
  executes_nothing boolean not null default true
    check (executes_nothing = true),
  publishes_nothing boolean not null default true
    check (publishes_nothing = true),
  schedules_nothing boolean not null default true
    check (schedules_nothing = true),
  mutates_no_scheduler boolean not null default true
    check (mutates_no_scheduler = true),
  mutates_no_publisher boolean not null default true
    check (mutates_no_publisher = true),
  mutates_no_ledger boolean not null default true
    check (mutates_no_ledger = true),
  mutates_no_approval boolean not null default true
    check (mutates_no_approval = true),
  mutates_no_manifest boolean not null default true
    check (mutates_no_manifest = true),
  mutates_no_targets boolean not null default true
    check (mutates_no_targets = true),
  exposes_no_api_routes boolean not null default true
    check (exposes_no_api_routes = true),
  performs_no_learning boolean not null default true
    check (performs_no_learning = true),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_metric_observations_value_status_valid
    check (
      (metric_status = 'completed' and metric_value is not null)
      or (metric_status in ('pending', 'failed') and metric_value is null)
    ),
  constraint social_publication_metric_observations_identity_separated
    check (
      metric_observation_id::text <> social_post_id::text
      and metric_observation_id::text <> publication_target_id::text
    ),
  constraint social_publication_metric_observations_idempotency_unique
    unique (idempotency_key)
);

create table if not exists public.social_publication_metric_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  metric_observation_id uuid not null
    references public.social_publication_metric_observations(metric_observation_id) on delete restrict,
  evidence_kind text not null
    check (evidence_kind in ('manual_note', 'report_reference', 'computed_summary', 'none')),
  notes text null
    check (notes is null or length(trim(notes)) > 0),
  evidence jsonb not null
    check (jsonb_typeof(evidence) = 'object'),
  external_report_reference text null
    check (external_report_reference is null or length(trim(external_report_reference)) > 0),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publisher_request_id uuid null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  publisher_job_id uuid null,
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in ('system', 'owner', 'admin', 'analytics', 'test')),
  recorded_source text not null
    check (recorded_source in ('publication_metrics_domain', 'manual_admin', 'test')),
  contains_platform_payload boolean not null default false
    check (contains_platform_payload = false),
  contains_secrets boolean not null default false
    check (contains_secrets = false),
  contains_credentials boolean not null default false
    check (contains_credentials = false),
  contains_sdk_client boolean not null default false
    check (contains_sdk_client = false),
  contains_raw_api_response boolean not null default false
    check (contains_raw_api_response = false),
  proves_collection boolean not null default false
    check (proves_collection = false),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_metric_evidence_idempotency_unique
    unique (idempotency_key)
);

create index if not exists social_publication_metric_observations_post_idx
  on public.social_publication_metric_observations (social_post_id, observed_at);

create index if not exists social_publication_metric_observations_target_idx
  on public.social_publication_metric_observations (publication_target_id, observed_at);

create index if not exists social_publication_metric_observations_publisher_job_idx
  on public.social_publication_metric_observations (publisher_job_id, observed_at);

create index if not exists social_publication_metric_observations_schedule_idx
  on public.social_publication_metric_observations (schedule_id, observed_at);

create index if not exists social_publication_metric_observations_ledger_idx
  on public.social_publication_metric_observations (ledger_entry_id, observed_at);

create index if not exists social_publication_metric_observations_manifest_idx
  on public.social_publication_metric_observations (publication_manifest_id, observed_at);

create index if not exists social_publication_metric_evidence_observation_idx
  on public.social_publication_metric_evidence (metric_observation_id, recorded_at);

create or replace function public.prevent_social_publication_metric_observation_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_metric_observations are append-only';
end;
$$;

drop trigger if exists social_publication_metric_observations_no_update
  on public.social_publication_metric_observations;
create trigger social_publication_metric_observations_no_update
  before update on public.social_publication_metric_observations
  for each row
  execute function public.prevent_social_publication_metric_observation_mutation();

drop trigger if exists social_publication_metric_observations_no_delete
  on public.social_publication_metric_observations;
create trigger social_publication_metric_observations_no_delete
  before delete on public.social_publication_metric_observations
  for each row
  execute function public.prevent_social_publication_metric_observation_mutation();

create or replace function public.prevent_social_publication_metric_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_metric_evidence are append-only';
end;
$$;

drop trigger if exists social_publication_metric_evidence_no_update
  on public.social_publication_metric_evidence;
create trigger social_publication_metric_evidence_no_update
  before update on public.social_publication_metric_evidence
  for each row
  execute function public.prevent_social_publication_metric_evidence_mutation();

drop trigger if exists social_publication_metric_evidence_no_delete
  on public.social_publication_metric_evidence;
create trigger social_publication_metric_evidence_no_delete
  before delete on public.social_publication_metric_evidence
  for each row
  execute function public.prevent_social_publication_metric_evidence_mutation();
