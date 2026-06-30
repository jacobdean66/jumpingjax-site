create table if not exists public.social_publication_ledger_attempts (
  ledger_entry_id uuid primary key default gen_random_uuid(),
  publication_attempt_id uuid not null unique default gen_random_uuid(),
  attempt_sequence integer not null
    check (attempt_sequence >= 0),
  event_type text not null
    check (event_type in (
      'publication_attempt_started',
      'publication_attempt_retry_started'
    )),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text not null
    check (length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  request_summary jsonb null
    check (request_summary is null or jsonb_typeof(request_summary) = 'object'),
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
      'publication_ledger_domain',
      'manual_admin',
      'future_scheduler',
      'future_publisher',
      'test'
    )),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_ledger_attempts_identity_separated
    check (ledger_entry_id <> publication_attempt_id),
  constraint social_publication_ledger_attempts_scope_identity_separated
    check (
      ledger_entry_id::text <> social_post_id::text
      and ledger_entry_id::text <> publication_target_id::text
      and ledger_entry_id::text <> publication_manifest_id
      and publication_attempt_id::text <> social_post_id::text
      and publication_attempt_id::text <> publication_target_id::text
      and publication_attempt_id::text <> publication_manifest_id
    ),
  constraint social_publication_ledger_attempts_summary_safe
    check (
      request_summary is null
      or (
        request_summary ->> 'containsFullPayload' = 'false'
        and request_summary ->> 'containsSecrets' = 'false'
      )
    ),
  constraint social_publication_ledger_attempts_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_ledger_attempts_attempt_scope_unique
    unique (
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    ),
  constraint social_publication_ledger_attempts_sequence_scope_unique
    unique (
      publication_attempt_id,
      attempt_sequence,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
);

create table if not exists public.social_publication_ledger_outcomes (
  ledger_entry_id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null unique default gen_random_uuid(),
  publication_attempt_id uuid not null
    references public.social_publication_ledger_attempts(publication_attempt_id) on delete restrict,
  attempt_sequence integer not null
    check (attempt_sequence >= 0),
  event_type text not null
    check (event_type in (
      'publication_attempt_succeeded',
      'publication_attempt_failed',
      'publication_attempt_cancelled',
      'publication_attempt_retry_requested',
      'publication_attempt_retry_succeeded',
      'publication_attempt_retry_failed'
    )),
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text not null
    check (length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  result_summary jsonb null
    check (result_summary is null or jsonb_typeof(result_summary) = 'object'),
  error_summary jsonb null
    check (error_summary is null or jsonb_typeof(error_summary) = 'object'),
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
      'publication_ledger_domain',
      'manual_admin',
      'future_scheduler',
      'future_publisher',
      'test'
    )),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_ledger_outcomes_identity_separated
    check (
      ledger_entry_id <> outcome_id
      and ledger_entry_id <> publication_attempt_id
      and outcome_id <> publication_attempt_id
    ),
  constraint social_publication_ledger_outcomes_scope_identity_separated
    check (
      ledger_entry_id::text <> social_post_id::text
      and ledger_entry_id::text <> publication_target_id::text
      and ledger_entry_id::text <> publication_manifest_id
      and outcome_id::text <> social_post_id::text
      and outcome_id::text <> publication_target_id::text
      and outcome_id::text <> publication_manifest_id
      and publication_attempt_id::text <> social_post_id::text
      and publication_attempt_id::text <> publication_target_id::text
      and publication_attempt_id::text <> publication_manifest_id
    ),
  constraint social_publication_ledger_outcomes_result_safe
    check (
      result_summary is null
      or (
        result_summary ->> 'containsFullResponse' = 'false'
        and result_summary ->> 'containsSecrets' = 'false'
      )
    ),
  constraint social_publication_ledger_outcomes_error_safe
    check (
      error_summary is null
      or (
        error_summary ->> 'containsFullResponse' = 'false'
        and error_summary ->> 'containsSecrets' = 'false'
      )
    ),
  constraint social_publication_ledger_outcomes_success_result_required
    check (
      event_type not in (
        'publication_attempt_succeeded',
        'publication_attempt_retry_succeeded'
      )
      or result_summary is not null
    ),
  constraint social_publication_ledger_outcomes_failure_error_required
    check (
      event_type not in (
        'publication_attempt_failed',
        'publication_attempt_retry_failed'
      )
      or error_summary is not null
    ),
  constraint social_publication_ledger_outcomes_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_ledger_outcomes_attempt_scope_fk
    foreign key (
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    references public.social_publication_ledger_attempts (
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    on delete restrict,
  constraint social_publication_ledger_outcomes_sequence_scope_fk
    foreign key (
      publication_attempt_id,
      attempt_sequence,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    references public.social_publication_ledger_attempts (
      publication_attempt_id,
      attempt_sequence,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    on delete restrict,
  constraint social_publication_ledger_outcomes_outcome_scope_unique
    unique (
      outcome_id,
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
);

create table if not exists public.social_publication_ledger_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  ledger_entry_id uuid not null unique default gen_random_uuid(),
  publication_attempt_id uuid not null
    references public.social_publication_ledger_attempts(publication_attempt_id) on delete restrict,
  outcome_id uuid null
    references public.social_publication_ledger_outcomes(outcome_id) on delete restrict,
  social_post_id uuid not null
    references public.social_posts(id) on delete restrict,
  publication_target_id uuid not null
    references public.social_publication_targets(publication_target_id) on delete restrict,
  publication_manifest_id text not null
    check (length(trim(publication_manifest_id)) > 0),
  owner_approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  approval_id uuid null
    references public.social_owner_approval_proposals(approval_id) on delete restrict,
  proposal_id uuid null
    references public.social_owner_approval_proposals(proposal_id) on delete restrict,
  evidence_summary jsonb not null
    check (jsonb_typeof(evidence_summary) = 'object'),
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
      'publication_ledger_domain',
      'manual_admin',
      'future_scheduler',
      'future_publisher',
      'test'
    )),
  append_only boolean not null default true
    check (append_only = true),
  immutable boolean not null default true
    check (immutable = true),
  idempotency_key text null
    check (idempotency_key is null or length(trim(idempotency_key)) > 0),

  constraint social_publication_ledger_evidence_identity_separated
    check (
      evidence_id <> ledger_entry_id
      and evidence_id <> publication_attempt_id
      and (
        outcome_id is null
        or (
          evidence_id <> outcome_id
          and ledger_entry_id <> outcome_id
          and publication_attempt_id <> outcome_id
        )
      )
    ),
  constraint social_publication_ledger_evidence_scope_identity_separated
    check (
      evidence_id::text <> social_post_id::text
      and evidence_id::text <> publication_target_id::text
      and evidence_id::text <> publication_manifest_id
      and ledger_entry_id::text <> social_post_id::text
      and ledger_entry_id::text <> publication_target_id::text
      and ledger_entry_id::text <> publication_manifest_id
      and publication_attempt_id::text <> social_post_id::text
      and publication_attempt_id::text <> publication_target_id::text
      and publication_attempt_id::text <> publication_manifest_id
    ),
  constraint social_publication_ledger_evidence_summary_safe
    check (
      evidence_summary ->> 'containsFullPayload' = 'false'
      and evidence_summary ->> 'containsFullResponse' = 'false'
      and evidence_summary ->> 'containsSecrets' = 'false'
    ),
  constraint social_publication_ledger_evidence_idempotency_unique
    unique (idempotency_key),
  constraint social_publication_ledger_evidence_attempt_scope_fk
    foreign key (
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    references public.social_publication_ledger_attempts (
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    on delete restrict,
  constraint social_publication_ledger_evidence_outcome_scope_fk
    foreign key (
      outcome_id,
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    references public.social_publication_ledger_outcomes (
      outcome_id,
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id
    )
    on delete restrict
);

create index if not exists social_publication_ledger_attempts_post_recorded_idx
  on public.social_publication_ledger_attempts (social_post_id, recorded_at desc);

create index if not exists social_publication_ledger_attempts_target_recorded_idx
  on public.social_publication_ledger_attempts (publication_target_id, recorded_at desc);

create index if not exists social_publication_ledger_attempts_scope_idx
  on public.social_publication_ledger_attempts (
    social_post_id,
    publication_target_id,
    publication_manifest_id,
    attempt_sequence
  );

create index if not exists social_publication_ledger_attempts_approval_idx
  on public.social_publication_ledger_attempts (approval_id, recorded_at desc)
  where approval_id is not null;

create index if not exists social_publication_ledger_outcomes_attempt_recorded_idx
  on public.social_publication_ledger_outcomes (publication_attempt_id, recorded_at desc);

create index if not exists social_publication_ledger_outcomes_post_recorded_idx
  on public.social_publication_ledger_outcomes (social_post_id, recorded_at desc);

create index if not exists social_publication_ledger_outcomes_target_recorded_idx
  on public.social_publication_ledger_outcomes (publication_target_id, recorded_at desc);

create index if not exists social_publication_ledger_outcomes_type_recorded_idx
  on public.social_publication_ledger_outcomes (event_type, recorded_at desc);

create index if not exists social_publication_ledger_evidence_attempt_recorded_idx
  on public.social_publication_ledger_evidence (publication_attempt_id, recorded_at desc);

create index if not exists social_publication_ledger_evidence_outcome_recorded_idx
  on public.social_publication_ledger_evidence (outcome_id, recorded_at desc)
  where outcome_id is not null;

create index if not exists social_publication_ledger_evidence_post_recorded_idx
  on public.social_publication_ledger_evidence (social_post_id, recorded_at desc);

create index if not exists social_publication_ledger_evidence_target_recorded_idx
  on public.social_publication_ledger_evidence (publication_target_id, recorded_at desc);

create or replace function public.validate_social_publication_ledger_outcome_scope()
returns trigger
language plpgsql
as $$
declare
  parent_attempt record;
begin
  select
    attempt_sequence,
    social_post_id,
    publication_target_id,
    publication_manifest_id,
    owner_approval_id,
    approval_id,
    proposal_id
  into parent_attempt
  from public.social_publication_ledger_attempts
  where publication_attempt_id = new.publication_attempt_id;

  if not found then
    raise exception 'publication outcome parent attempt is missing';
  end if;

  if parent_attempt.attempt_sequence <> new.attempt_sequence
    or parent_attempt.social_post_id <> new.social_post_id
    or parent_attempt.publication_target_id <> new.publication_target_id
    or parent_attempt.publication_manifest_id <> new.publication_manifest_id
    or parent_attempt.owner_approval_id is distinct from new.owner_approval_id
    or parent_attempt.approval_id is distinct from new.approval_id
    or parent_attempt.proposal_id is distinct from new.proposal_id
  then
    raise exception 'publication outcome scope must match parent attempt scope';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_ledger_outcome_scope_insert
  on public.social_publication_ledger_outcomes;
create trigger validate_social_publication_ledger_outcome_scope_insert
  before insert on public.social_publication_ledger_outcomes
  for each row
  execute function public.validate_social_publication_ledger_outcome_scope();

create or replace function public.validate_social_publication_ledger_evidence_scope()
returns trigger
language plpgsql
as $$
declare
  parent_attempt record;
  parent_outcome record;
begin
  select
    social_post_id,
    publication_target_id,
    publication_manifest_id,
    owner_approval_id,
    approval_id,
    proposal_id
  into parent_attempt
  from public.social_publication_ledger_attempts
  where publication_attempt_id = new.publication_attempt_id;

  if not found then
    raise exception 'publication evidence parent attempt is missing';
  end if;

  if parent_attempt.social_post_id <> new.social_post_id
    or parent_attempt.publication_target_id <> new.publication_target_id
    or parent_attempt.publication_manifest_id <> new.publication_manifest_id
    or parent_attempt.owner_approval_id is distinct from new.owner_approval_id
    or parent_attempt.approval_id is distinct from new.approval_id
    or parent_attempt.proposal_id is distinct from new.proposal_id
  then
    raise exception 'publication evidence scope must match parent attempt scope';
  end if;

  if new.outcome_id is not null then
    select
      publication_attempt_id,
      social_post_id,
      publication_target_id,
      publication_manifest_id,
      owner_approval_id,
      approval_id,
      proposal_id
    into parent_outcome
    from public.social_publication_ledger_outcomes
    where outcome_id = new.outcome_id;

    if not found then
      raise exception 'publication evidence parent outcome is missing';
    end if;

    if parent_outcome.publication_attempt_id <> new.publication_attempt_id
      or parent_outcome.social_post_id <> new.social_post_id
      or parent_outcome.publication_target_id <> new.publication_target_id
      or parent_outcome.publication_manifest_id <> new.publication_manifest_id
      or parent_outcome.owner_approval_id is distinct from new.owner_approval_id
      or parent_outcome.approval_id is distinct from new.approval_id
      or parent_outcome.proposal_id is distinct from new.proposal_id
    then
      raise exception 'publication evidence scope must match parent outcome scope';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_social_publication_ledger_evidence_scope_insert
  on public.social_publication_ledger_evidence;
create trigger validate_social_publication_ledger_evidence_scope_insert
  before insert on public.social_publication_ledger_evidence
  for each row
  execute function public.validate_social_publication_ledger_evidence_scope();

create or replace function public.prevent_social_publication_ledger_attempt_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_ledger_attempts are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_ledger_attempt_updates
  on public.social_publication_ledger_attempts;
create trigger prevent_social_publication_ledger_attempt_updates
  before update on public.social_publication_ledger_attempts
  for each row
  execute function public.prevent_social_publication_ledger_attempt_changes();

drop trigger if exists prevent_social_publication_ledger_attempt_deletes
  on public.social_publication_ledger_attempts;
create trigger prevent_social_publication_ledger_attempt_deletes
  before delete on public.social_publication_ledger_attempts
  for each row
  execute function public.prevent_social_publication_ledger_attempt_changes();

create or replace function public.prevent_social_publication_ledger_outcome_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_ledger_outcomes are append-only';
end;
$$;

drop trigger if exists prevent_social_publication_ledger_outcome_updates
  on public.social_publication_ledger_outcomes;
create trigger prevent_social_publication_ledger_outcome_updates
  before update on public.social_publication_ledger_outcomes
  for each row
  execute function public.prevent_social_publication_ledger_outcome_changes();

drop trigger if exists prevent_social_publication_ledger_outcome_deletes
  on public.social_publication_ledger_outcomes;
create trigger prevent_social_publication_ledger_outcome_deletes
  before delete on public.social_publication_ledger_outcomes
  for each row
  execute function public.prevent_social_publication_ledger_outcome_changes();

create or replace function public.prevent_social_publication_ledger_evidence_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_publication_ledger_evidence is append-only';
end;
$$;

drop trigger if exists prevent_social_publication_ledger_evidence_updates
  on public.social_publication_ledger_evidence;
create trigger prevent_social_publication_ledger_evidence_updates
  before update on public.social_publication_ledger_evidence
  for each row
  execute function public.prevent_social_publication_ledger_evidence_changes();

drop trigger if exists prevent_social_publication_ledger_evidence_deletes
  on public.social_publication_ledger_evidence;
create trigger prevent_social_publication_ledger_evidence_deletes
  before delete on public.social_publication_ledger_evidence
  for each row
  execute function public.prevent_social_publication_ledger_evidence_changes();

alter table public.social_publication_ledger_attempts enable row level security;
alter table public.social_publication_ledger_outcomes enable row level security;
alter table public.social_publication_ledger_evidence enable row level security;

drop policy if exists "No public social publication ledger attempts access"
  on public.social_publication_ledger_attempts;
create policy "No public social publication ledger attempts access"
  on public.social_publication_ledger_attempts
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication ledger outcomes access"
  on public.social_publication_ledger_outcomes;
create policy "No public social publication ledger outcomes access"
  on public.social_publication_ledger_outcomes
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public social publication ledger evidence access"
  on public.social_publication_ledger_evidence;
create policy "No public social publication ledger evidence access"
  on public.social_publication_ledger_evidence
  for all
  to anon, authenticated
  using (false)
  with check (false);
