-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 012: Phase 13
--
-- 1. agent_intel_profile_history — immutable version log per field change
-- 2. aggregator_config — configurable thresholds per user (no hardcoded values)
-- 3. canal_preferido column — formally adds column referenced in Rule 2 since Phase 11
-- 4. cron_job_runs — audit log for scheduled jobs (cleanup, aggregator, briefing)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TABLE: agent_intel_profile_history ──────────────────────────────────────
-- Immutable. Every modification to agent_intelligence_profiles is recorded here.
-- Allows full audit trail and point-in-time revert.

create table if not exists public.agent_intel_profile_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,

  -- Which field changed
  campo           text not null,
  -- Values
  valor_anterior  jsonb,                  -- NULL if this is the first time the field is set
  valor_nuevo     jsonb not null,         -- The value that was applied
  -- Provenance
  source_type     text not null check (source_type in (
    'declarado',      -- Agent typed it directly (onboarding, Brand Builder form)
    'inferencia_ia',  -- Proposed by Evidence Aggregator and approved by agent
    'inferencia_editada', -- Proposed by IA, edited by agent before applying
    'reversion',      -- Agent reverted to a previous version
    'importado'       -- Imported from external source (future)
  )),
  origen          text,       -- 'brand_builder' | 'onboarding' | 'interview' | 'evidence_aggregator'
  motivo          text,       -- Human-readable reason (optional, provided by agent or system)
  fuente_evidencia text,      -- Evidence source when source_type = 'inferencia_ia'
  evidence_count  integer,    -- Number of signals when source_type = 'inferencia_ia'
  -- Metadata
  created_at      timestamptz not null default now()
  -- NOTE: No updated_at — this table is immutable. Never UPDATE rows here.
);

comment on table public.agent_intel_profile_history
  is 'Immutable audit log of every change to agent_intelligence_profiles. Each row = one field change. Never update rows.';

create index if not exists idx_intel_history_user_campo
  on public.agent_intel_profile_history(user_id, campo, created_at desc);

create index if not exists idx_intel_history_user_date
  on public.agent_intel_profile_history(user_id, created_at desc);

alter table public.agent_intel_profile_history enable row level security;

create policy "Users can view their own profile history"
  on public.agent_intel_profile_history for select using (auth.uid() = user_id);

-- No INSERT policy for users — inserts only happen via service_role functions below.

-- ─── FUNCTION: record_intel_profile_change ────────────────────────────────────
-- Called by the application layer whenever agent_intelligence_profiles is updated.
-- Idempotent in the sense that it only records real changes (valor_anterior ≠ valor_nuevo).

create or replace function public.record_intel_profile_change(
  p_user_id        uuid,
  p_campo          text,
  p_valor_anterior jsonb,
  p_valor_nuevo    jsonb,
  p_source_type    text,
  p_origen         text default null,
  p_motivo         text default null,
  p_fuente_evidencia text default null,
  p_evidence_count integer default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_history_id uuid;
begin
  -- Don't record if value didn't actually change
  if p_valor_anterior is not distinct from p_valor_nuevo then
    return null;
  end if;

  insert into public.agent_intel_profile_history (
    user_id, campo, valor_anterior, valor_nuevo,
    source_type, origen, motivo, fuente_evidencia, evidence_count
  ) values (
    p_user_id, p_campo, p_valor_anterior, p_valor_nuevo,
    p_source_type, p_origen, p_motivo, p_fuente_evidencia, p_evidence_count
  )
  returning id into v_history_id;

  return v_history_id;
end;
$$;

-- ─── TABLE: aggregator_config ──────────────────────────────────────────────────
-- Configurable thresholds for the Evidence Aggregator.
-- One row per user_id. If no row exists for a user, the system uses the global defaults.
-- Global defaults are stored with user_id = NULL.

create table if not exists public.aggregator_config (
  id                                    uuid primary key default gen_random_uuid(),
  user_id                               uuid references public.profiles(id) on delete cascade,
  -- Uniqueness: one config per user (or one global default)
  -- Thresholds for Rule 1: Frequent objection types
  r1_min_signals                        integer not null default 3,    -- min objections of same type
  r1_window_days                        integer not null default 90,   -- lookback window
  -- Thresholds for Rule 2: Primary channel
  r2_min_sessions                       integer not null default 5,    -- min sessions in window
  r2_window_days                        integer not null default 30,
  -- Thresholds for Rule 3: Primary products
  r3_min_signals                        integer not null default 5,    -- combined contenidos+objections
  r3_min_per_product                    integer not null default 3,    -- min signals per product
  r3_window_days                        integer not null default 60,
  -- Thresholds for Rule 4: Observed tone
  r4_min_useful_responses               integer not null default 3,    -- min fue_util='si'
  -- Thresholds for Rule 5: Market (mercado_objetivo)
  r5_min_prospects                      integer not null default 4,    -- min prospects described
  r5_min_pattern_count                  integer not null default 3,    -- min matching origin/age
  r5_window_days                        integer not null default 60,
  -- Thresholds for Rule 6: CTAs efectivos
  r6_min_useful_responses               integer not null default 3,
  r6_min_phrase_repetitions             integer not null default 2,
  r6_window_days                        integer not null default 60,
  -- Thresholds for Rule 7: Frases propias
  r7_min_phrase_repetitions             integer not null default 2,
  r7_max_existing_frases                integer not null default 5,    -- skip if already has enough
  r7_max_interview_sessions             integer not null default 3,    -- how many sessions to scan
  -- Confidence thresholds
  conf_high_min_signals                 integer not null default 5,    -- signals for HIGH confidence
  conf_high_min_sources                 integer not null default 2,    -- unique sources for HIGH
  conf_high_min_days                    integer not null default 14,   -- span for HIGH
  conf_medium_min_signals               integer not null default 3,    -- signals for MEDIUM
  -- Rejection guard
  rejection_reproposal_evidence_factor  numeric(3,1) not null default 1.5, -- 1.5x evidence needed
  rejection_reproposal_min_days         integer not null default 14,   -- 14 days since rejection
  -- Cleanup policy (mirrors Decisión C)
  cleanup_max_evidence_for_removal      integer not null default 3,    -- must be < this
  cleanup_min_age_days                  integer not null default 180,  -- must be older than this
  -- Metadata
  created_at                            timestamptz not null default now(),
  updated_at                            timestamptz not null default now(),
  constraint aggregator_config_user_unique unique (user_id)
);

-- Seed global defaults (user_id = NULL = global)
insert into public.aggregator_config (user_id) values (null)
on conflict (user_id) do nothing;

alter table public.aggregator_config enable row level security;

-- Users can read their own config (or global defaults)
create policy "Users can read their own aggregator config"
  on public.aggregator_config for select
  using (auth.uid() = user_id or user_id is null);

-- Users can update only their own config
create policy "Users can upsert their own aggregator config"
  on public.aggregator_config for all
  using (auth.uid() = user_id);

-- ─── ALTER: agent_intelligence_profiles — canal_preferido ─────────────────────
-- Rule 2 references this field since Phase 11. Formally adding the column.

alter table public.agent_intelligence_profiles
  add column if not exists canal_preferido          text,
  add column if not exists canal_preferido_source   text default 'declarado'
    check (canal_preferido_source in ('declarado','observado','inferido','hipotesis','confirmado'));

-- ─── TABLE: cron_job_runs ─────────────────────────────────────────────────────
-- Audit log for all scheduled and manual job executions.
-- Provides traceability and non-interference between jobs.

create table if not exists public.cron_job_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null,        -- 'cleanup_rejection_log' | 'run_aggregator' | 'briefing_lunes'
  trigger_type  text not null check (trigger_type in ('scheduled','manual','api')),
  status        text not null check (status in ('running','completed','failed','skipped')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  users_processed integer,
  records_affected integer,
  error_message text,
  metadata      jsonb default '{}'::jsonb
);

create index if not exists idx_cron_runs_job_date
  on public.cron_job_runs(job_name, started_at desc);

alter table public.cron_job_runs enable row level security;
-- Only service_role can write; admins can read via service_role
create policy "Service role manages cron runs"
  on public.cron_job_runs for all using (true);
