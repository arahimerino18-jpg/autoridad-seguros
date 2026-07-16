-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 010: Phase 11 Evidence Aggregator
--
-- The Evidence Aggregator proposes inferences based on accumulated signals.
-- IT NEVER auto-applies changes to agent_intelligence_profiles.
-- All proposed inferences go to inferencias_pendientes for human review.
--
-- Changes:
-- 1. inferencias_pendientes JSONB structure is extended (data in existing column)
-- 2. agent_intelligence_profiles: add rejection_log to avoid re-proposing same inferences
-- 3. evidence_aggregator_runs: audit log of when aggregation ran and what it found
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── EXTEND: agent_intelligence_profiles ─────────────────────────────────────
-- rejection_log: tracks which inferences were rejected to prevent re-proposing
-- Structure: [{campo, valor_inferido_hash, rechazado_en, razon?}]
-- Hash avoids re-proposing the same conclusion without significantly new evidence.

alter table public.agent_intelligence_profiles
  add column if not exists inference_rejection_log jsonb default '[]'::jsonb;

comment on column public.agent_intelligence_profiles.inference_rejection_log
  is 'Array of rejected inferences. Prevents re-proposing the same conclusion without new strong evidence. Structure: [{campo, valor_hash, rechazado_en, razon}]';

-- ─── TABLE: evidence_aggregator_runs ─────────────────────────────────────────
-- Immutable audit log. Every time the aggregator runs for a user, it's recorded here.
-- Allows: debugging, cost tracking, and understanding what triggered inferences.

create table if not exists public.evidence_aggregator_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  ran_at              timestamptz not null default now(),
  -- What the aggregator processed
  signals_analyzed    integer not null default 0,
  sources_checked     text[] not null default '{}',  -- e.g. ['objection_responses', 'analytics_events']
  -- What it found
  inferences_proposed integer not null default 0,
  inferences_skipped  integer not null default 0,    -- Already in pending or rejected
  -- Summary for debugging
  run_summary         jsonb default '{}'::jsonb,
  -- Whether triggered manually or by a scheduled job
  trigger_type        text not null default 'manual'
    check (trigger_type in ('manual', 'scheduled', 'post_onboarding'))
);

create index if not exists idx_aggregator_runs_user
  on public.evidence_aggregator_runs(user_id, ran_at desc);

alter table public.evidence_aggregator_runs enable row level security;
create policy "Users can view their own aggregator runs"
  on public.evidence_aggregator_runs for select using (auth.uid() = user_id);

-- ─── DOCUMENTATION: extended InferenciaPendiente structure ───────────────────
-- The inferencias_pendientes JSONB column stores an array of these objects.
-- This is the FULL structure used by the Phase 11 Evidence Aggregator.
-- (TypeScript interface will be updated in database.ts — no schema change needed)
--
-- {
--   campo: string,                   -- field in agent_intelligence_profiles to update
--   valor_actual: unknown,           -- current value (null if empty)
--   valor_inferido: unknown,         -- proposed new value
--   fuente: string,                  -- which aggregator rule proposed this
--   fecha_inferencia: string,        -- ISO timestamp
--   descripcion: string,             -- human-readable explanation
--   -- Phase 11 extensions:
--   evidence_count: number,          -- how many signals support this
--   evidence_sources: string[],      -- which tables/modules provided signals
--   confidence: 'low'|'medium'|'high', -- overall confidence level
--   signal_summary: string,          -- concise summary of what was observed
--   valor_hash: string,              -- hash of valor_inferido for rejection dedup
--   status: 'pending'|'approved'|'rejected', -- current state (stored separately but useful)
-- }
--
-- REJECTION: when rejected, move to inference_rejection_log with reason.
-- RE-PROPOSAL: only allowed if evidence_count > prev_rejection_evidence_count * 1.5
--              AND at least 14 days have passed since rejection.
