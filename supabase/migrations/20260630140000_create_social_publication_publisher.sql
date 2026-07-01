create table if not exists public.social_publication_publisher_requests (
  publisher_request_id uuid primary key default gen_random_uuid(),
  publisher_job_id uuid not null unique default gen_random_uuid(),
  request_type text not null
    check (request_type in (
      'prepare_publication_request'
    )),
  channel_id text not null
    check (length(trim(channel_id)) > 0),
  channel_platform text not null
    check (channel_platform in ('facebook', 'instagram')),
  channel_type text not null
    check (channel_type in ('facebook_page', 'instagram_business_account')),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_attempt_id uuid null
    references public.social_publication_ledger_attempts(publication_attempt_id) on delete restrict,
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  owner_approval_satisfied boolean not null default false,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_publisher_domain',
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
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_publisher_requests_channel_identity_valid
    check (
      (channel_type = 'facebook_page' and channel_platform = 'facebook')
      or (channel_type = 'instagram_business_account' and channel_platform = 'instagram')
    ),
  constraint social_publication_publisher_requests_identity_separated
    check (
      publisher_request_id <> publisher_job_id
      and publisher_request_id::text <> social_post_id::text
      and publisher_request_id::text <> publication_target_id::text
      and publisher_job_id::text <> social_post_id::text
      and publisher_job_id::text <> publication_target_id::text
    ),
  constraint social_publication_publisher_requests_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_publisher_requests_job_scope_unique
    unique (publisher_request_id, publisher_job_id)
);

create table if not exists public.social_publication_publisher_results (
  publisher_result_id uuid primary key default gen_random_uuid(),
  publisher_request_id uuid not null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_job_id uuid not null,
  result_type text not null
    check (result_type in (
      'publication_request_prepared',
      'publication_request_rejected'
    )),
  result_status text not null
    check (result_status in ('prepared', 'rejected')),
  channel_id text not null
    check (length(trim(channel_id)) > 0),
  channel_platform text not null
    check (channel_platform in ('facebook', 'instagram')),
  channel_type text not null
    check (channel_type in ('facebook_page', 'instagram_business_account')),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_attempt_id uuid null
    references public.social_publication_ledger_attempts(publication_attempt_id) on delete restrict,
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  result_code text null
    check (result_code is null or length(trim(result_code)) > 0),
  error_code text null
    check (error_code is null or length(trim(error_code)) > 0),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_publisher_domain',
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
  current_publish_status_authority boolean not null default false
    check (current_publish_status_authority = false),
  records_no_metrics boolean not null default true
    check (records_no_metrics = true),
  performs_no_learning boolean not null default true
    check (performs_no_learning = true),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_publisher_results_channel_identity_valid
    check (
      (channel_type = 'facebook_page' and channel_platform = 'facebook')
      or (channel_type = 'instagram_business_account' and channel_platform = 'instagram')
    ),
  constraint social_publication_publisher_results_identity_separated
    check (
      publisher_result_id <> publisher_request_id
      and publisher_result_id <> publisher_job_id
      and publisher_result_id::text <> social_post_id::text
      and publisher_result_id::text <> publication_target_id::text
    ),
  constraint social_publication_publisher_results_result_code_required
    check (
      result_status <> 'prepared'
      or result_code is not null
    ),
  constraint social_publication_publisher_results_error_code_required
    check (
      result_status <> 'rejected'
      or error_code is not null
    ),
  constraint social_publication_publisher_results_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_publisher_results_request_job_scope_fk
    foreign key (publisher_request_id, publisher_job_id)
    references public.social_publication_publisher_requests (publisher_request_id, publisher_job_id)
    on delete restrict
);

create table if not exists public.social_publication_publisher_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  publisher_request_id uuid not null
    references public.social_publication_publisher_requests(publisher_request_id) on delete restrict,
  publisher_result_id uuid null
    references public.social_publication_publisher_results(publisher_result_id) on delete restrict,
  evidence_kind text not null
    check (evidence_kind in (
      'request_contract',
      'result_contract',
      'error_contract',
      'authority_check',
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
  publication_manifest_id text null
    check (publication_manifest_id is null or length(trim(publication_manifest_id)) > 0),
  schedule_id uuid null,
  ledger_entry_id uuid null
    references public.social_publication_ledger_attempts(ledger_entry_id) on delete restrict,
  publication_attempt_id uuid null
    references public.social_publication_ledger_attempts(publication_attempt_id) on delete restrict,
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  recorded_by_actor text not null
    check (recorded_by_actor in (
      'system',
      'owner',
      'admin',
      'scheduler',
      'publisher',
      'test'
    )),
  recorded_source text not null
    check (recorded_source in (
      'publication_publisher_domain',
      'manual_admin',
      'test'
    )),
  contains_full_payload boolean not null default false
    check (contains_full_payload = false),
  contains_full_response boolean not null default false
    check (contains_full_response = false),
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

  constraint social_publication_publisher_evidence_identity_separated
    check (
      evidence_id <> publisher_request_id
      and (publisher_result_id is null or evidence_id <> publisher_result_id)
      and evidence_id::text <> social_post_id::text
      and evidence_id::text <> publication_target_id::text
    ),
  constraint social_publication_publisher_evidence_summary_safe
    check (
      evidence ->> 'containsFullPayload' is distinct from 'true'
      and evidence ->> 'containsFullResponse' is distinct from 'true'
      and evidence ->> 'containsSecrets' is distinct from 'true'
    ),
  constraint social_publication_publisher_evidence_idempotency_unique
    unique (idempotency_key)
);

create index if not exists social_publication_publisher_requests_post_requested_idx
  on public.social_publication_publisher_requests (social_post_id, requested_at desc);

create index if not exists social_publication_publisher_requests_target_requested_idx
  on public.social_publication_publisher_requests (publication_target_id, requested_at desc);

create index if not exists social_publication_publisher_requests_manifest_idx
  on public.social_publication_publisher_requests (publication_manifest_id, requested_at desc)
  where publication_manifest_id is not null;

create index if not exists social_publication_publisher_requests_schedule_idx
  on public.social_publication_publisher_requests (schedule_id, requested_at desc)
  where schedule_id is not null;

create index if not exists social_publication_publisher_requests_ledger_idx
  on public.social_publication_publisher_requests (ledger_entry_id, requested_at desc)
  where ledger_entry_id is not null;

create index if not exists social_publication_publisher_requests_approval_idx
  on public.social_publication_publisher_requests (approval_id, requested_at desc)
  where approval_id is not null;

create index if not exists social_publication_publisher_results_request_recorded_idx
  on public.social_publication_publisher_results (publisher_request_id, recorded_at desc);

create index if not exists social_publication_publisher_results_post_recorded_idx
  on public.social_publication_publisher_results (social_post_id, recorded_at desc);

create index if not exists social_publication_publisher_results_target_recorded_idx
  on public.social_publication_publisher_results (publication_target_id, recorded_at desc);

create index if not exists social_publication_publisher_results_status_recorded_idx
  on public.social_publication_publisher_results (result_status, recorded_at desc);

create index if not exists social_publication_publisher_evidence_request_recorded_idx
  on public.social_publication_publisher_evidence (publisher_request_id, recorded_at desc);

create index if not exists social_publication_publisher_evidence_result_recorded_idx
  on public.social_publication_publisher_evidence (publisher_result_id, recorded_at desc)
  where publisher_result_id is not null;

create index if not exists social_publication_publisher_evidence_post_recorded_idx
  on public.social_publication_publisher_evidence (social_post_id, recorded_at desc);

create or replace function public.validate_social_publication_publisher_result_scope()
returns trigger
language plpgsql
as $$
declare
  parent_request record;
begin
  select
    social_post_id,
    publication_target_id,
    publication_manifest_id,
    schedule_id,
    ledger_entry_id,
    publication_attempt_id,
    owner_approval_id,
    approval_id,
    proposal_id
  into parent_request
  from public.social_publication_publisher_requests
  where publisher_request_id = new.publisher_request_id;

  if not found then
    raise exception 'publisher result parent request is missing';
  end if;

  if parent_request.social_post_id <> new.social_post_id
    or parent_request.publication_target_id <> new.publication_target_id
    or parent_request.publication_manifest_id is distinct from new.publication_manifest_id
    or parent_request.schedule_id is distinct from new.schedule_id
    or parent_request.ledger_entry_id is distinct from new.ledger_entry_id
    or parent_request.publication_attempt_id is distinct from new.publication_attempt_id
    or parent_request.owner_approval_id is distinct from new.owner_approval_id
    or parent_request.approval_id is distinct from new.approval_id
    or parent_request.proposal_id is distinct from new.proposal_id
  then
    raise exception 'publisher result scope must match parent request scope';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_publisher_result_scope_insert
  on public.social_publication_publisher_results;
create trigger validate_social_publication_publisher_result_scope_insert
  before insert on public.social_publication_publisher_results
  for each row
  execute function public.validate_social_publication_publisher_result_scope();

create or replace function public.validate_social_publication_publisher_evidence_scope()
returns trigger
language plpgsql
as $$
declare
  parent_request record;
  parent_result record;
begin
  select
    social_post_id,
    publication_target_id,
    publication_manifest_id,
    schedule_id,
    ledger_entry_id,
    publication_attempt_id,
    owner_approval_id,
    approval_id,
    proposal_id
  into parent_request
  from public.social_publication_publisher_requests
  where publisher_request_id = new.publisher_request_id;

  if not found then
    raise exception 'publisher evidence parent request is missing';
  end if;

  if parent_request.social_post_id <> new.social_post_id
    or parent_request.publication_target_id <> new.publication_target_id
    or parent_request.publication_manifest_id is distinct from new.publication_manifest_id
    or parent_request.schedule_id is distinct from new.schedule_id
    or parent_request.ledger_entry_id is distinct from new.ledger_entry_id
    or parent_request.publication_attempt_id is distinct from new.publication_attempt_id
    or parent_request.owner_approval_id is distinct from new.owner_approval_id
    or parent_request.approval_id is distinct from new.approval_id
    or parent_request.proposal_id is distinct from new.proposal_id
  then
    raise exception 'publisher evidence scope must match parent request scope';
  end if;

  if new.publisher_result_id is not null then
    select publisher_request_id
    into parent_result
    from public.social_publication_publisher_results
    where publisher_result_id = new.publisher_result_id;

    if not found then
      raise exception 'publisher evidence parent result is missing';
    end if;

    if parent_result.publisher_request_id <> new.publisher_request_id then
      raise exception 'publisher evidence result must belong to the same request';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_publisher_evidence_scope_insert
  on public.social_publication_publisher_evidence;
create trigger validate_social_publication_publisher_evidence_scope_insert
  before insert on public.social_publication_publisher_evidence
  for each row
  execute function public.validate_social_publication_publisher_evidence_scope();

create or replace function public.prevent_social_publication_publisher_request_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_publisher_requests are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_publisher_request_updates
  on public.social_publication_publisher_requests;
create trigger prevent_social_publication_publisher_request_updates
  before update on public.social_publication_publisher_requests
  for each row
  execute function public.prevent_social_publication_publisher_request_changes();

drop trigger if exists prevent_social_publication_publisher_request_deletes
  on public.social_publication_publisher_requests;
create trigger prevent_social_publication_publisher_request_deletes
  before delete on public.social_publication_publisher_requests
  for each row
  execute function public.prevent_social_publication_publisher_request_changes();

create or replace function public.prevent_social_publication_publisher_result_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_publisher_results are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_publisher_result_updates
  on public.social_publication_publisher_results;
create trigger prevent_social_publication_publisher_result_updates
  before update on public.social_publication_publisher_results
  for each row
  execute function public.prevent_social_publication_publisher_result_changes();

drop trigger if exists prevent_social_publication_publisher_result_deletes
  on public.social_publication_publisher_results;
create trigger prevent_social_publication_publisher_result_deletes
  before delete on public.social_publication_publisher_results
  for each row
  execute function public.prevent_social_publication_publisher_result_changes();

create or replace function public.prevent_social_publication_publisher_evidence_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_publisher_evidence is append-only';
end;
$$;

drop trigger if exists prevent_social_publication_publisher_evidence_updates
  on public.social_publication_publisher_evidence;
create trigger prevent_social_publication_publisher_evidence_updates
  before update on public.social_publication_publisher_evidence
  for each row
  execute function public.prevent_social_publication_publisher_evidence_changes();

drop trigger if exists prevent_social_publication_publisher_evidence_deletes
  on public.social_publication_publisher_evidence;
create trigger prevent_social_publication_publisher_evidence_deletes
  before delete on public.social_publication_publisher_evidence
  for each row
  execute function public.prevent_social_publication_publisher_evidence_changes();

alter table public.social_publication_publisher_requests enable row level security;
alter table public.social_publication_publisher_results enable row level security;
alter table public.social_publication_publisher_evidence enable row level security;

drop policy if exists "No public social publication publisher requests access"
  on public.social_publication_publisher_requests;
create policy "No public social publication publisher requests access"
  on public.social_publication_publisher_requests
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication publisher results access"
  on public.social_publication_publisher_results;
create policy "No public social publication publisher results access"
  on public.social_publication_publisher_results
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication publisher evidence access"
  on public.social_publication_publisher_evidence;
create policy "No public social publication publisher evidence access"
  on public.social_publication_publisher_evidence
  for all
  to anon, authenticated
  using (false)
  with check (false);
