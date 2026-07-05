-- D16 Wave 8: Execution Attempt Evidence & State Transition Modeling (append-only, metadata-only)

create table if not exists public.social_execution_attempt_evidence (
  evidence_id text primary key,
  evidence_version text not null,
  attempt_id text not null
    references public.social_execution_attempts (attempt_id),
  correlation_id text not null,
  transition_id text,
  evidence_kind text not null,
  sanitized_summary text not null,
  evidence_payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  recorded_by_actor text not null,
  recorded_source text not null
);

create index if not exists social_execution_attempt_evidence_attempt_idx
  on public.social_execution_attempt_evidence (attempt_id, recorded_at desc);

create index if not exists social_execution_attempt_evidence_correlation_idx
  on public.social_execution_attempt_evidence (correlation_id, recorded_at desc);

create index if not exists social_execution_attempt_evidence_transition_idx
  on public.social_execution_attempt_evidence (transition_id, recorded_at desc);

create table if not exists public.social_execution_attempt_state_transitions (
  transition_id text primary key,
  transition_version text not null,
  attempt_id text not null
    references public.social_execution_attempts (attempt_id),
  correlation_id text not null,
  from_state text not null,
  to_state text not null,
  transition_kind text not null,
  evidence_id text
    references public.social_execution_attempt_evidence (evidence_id),
  created_at timestamptz not null default now()
);

create index if not exists social_execution_attempt_state_transitions_attempt_idx
  on public.social_execution_attempt_state_transitions (attempt_id, created_at desc);

create index if not exists social_execution_attempt_state_transitions_correlation_idx
  on public.social_execution_attempt_state_transitions (correlation_id, created_at desc);

create or replace function public.prevent_social_execution_attempt_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'social_execution_attempt evidence tables are append-only';
end;
$$;

drop trigger if exists social_execution_attempt_evidence_no_mutation
  on public.social_execution_attempt_evidence;
create trigger social_execution_attempt_evidence_no_mutation
before update or delete on public.social_execution_attempt_evidence
for each row execute function public.prevent_social_execution_attempt_evidence_mutation();

drop trigger if exists social_execution_attempt_state_transitions_no_mutation
  on public.social_execution_attempt_state_transitions;
create trigger social_execution_attempt_state_transitions_no_mutation
before update or delete on public.social_execution_attempt_state_transitions
for each row execute function public.prevent_social_execution_attempt_evidence_mutation();

alter table public.social_execution_attempt_evidence enable row level security;
alter table public.social_execution_attempt_state_transitions enable row level security;
