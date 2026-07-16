-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 013: Phase 15
--
-- 1. inference_lifecycle_log — tracks full lifecycle of every inference
-- 2. Backfill function — migrates existing profile data to history
-- 3. Performance indexes — optimized queries for dashboard
-- 4. aggregator_cron_config — schedule config for the weekly aggregator job
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TABLE: inference_lifecycle_log ──────────────────────────────────────────
-- Immutable. Records every state transition of every inference.
-- Lifecycle: pendiente → aprobada → aplicada → revertida (optional) → archivada

create table if not exists public.inference_lifecycle_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,

  -- Identity: what inference this is
  campo           text not null,
  valor_hash      text not null,       -- same hash as in inferencias_pendientes
  fuente          text,                -- which rule proposed this
  evidence_count  integer,

  -- Lifecycle state
  estado          text not null check (estado in (
    'pendiente',    -- Just proposed by Evidence Aggregator
    'aprobada',     -- Agent approved (may have been edited)
    'aplicada',     -- Value written to agent_intelligence_profiles
    'revertida',    -- Agent reverted the applied value
    'archivada',    -- Rejected and archived
    'rechazada'     -- Rejected (not yet archived)
  )),
  edited          boolean not null default false,  -- Was value edited before applying?

  -- What happened at this transition
  valor_propuesto jsonb,               -- The original AI proposal
  valor_aplicado  jsonb,               -- What was actually written (may differ if edited)
  motivo          text,                -- Human-readable reason for this transition

  -- Agent action tracking
  action_by       text not null default 'agent' check (action_by in ('agent','system','cron')),

  -- Timing
  created_at      timestamptz not null default now()
);

comment on table public.inference_lifecycle_log
  is 'Immutable lifecycle audit for every inference. One row per state transition.';

create index if not exists idx_lifecycle_user_campo
  on public.inference_lifecycle_log(user_id, campo, created_at desc);

create index if not exists idx_lifecycle_user_estado
  on public.inference_lifecycle_log(user_id, estado, created_at desc);

create index if not exists idx_lifecycle_hash
  on public.inference_lifecycle_log(user_id, valor_hash);

alter table public.inference_lifecycle_log enable row level security;
create policy "Users can view their own inference lifecycle"
  on public.inference_lifecycle_log for select using (auth.uid() = user_id);

-- ─── FUNCTION: backfill_intel_profile_history ────────────────────────────────
-- Creates a single baseline history entry for each non-null field
-- in agent_intelligence_profiles for users who existed before Phase 14.
-- Idempotent: skips users who already have history entries.

create or replace function public.backfill_intel_profile_history(p_user_id uuid default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_profile   record;
  v_count     integer := 0;
  v_has_hist  boolean;
begin
  for v_profile in
    select aip.*, p.nombre_completo
    from public.agent_intelligence_profiles aip
    join public.profiles p on p.id = aip.user_id
    where (p_user_id is null or aip.user_id = p_user_id)
  loop
    -- Check if user already has history (skip if so)
    select exists(
      select 1 from public.agent_intel_profile_history
      where user_id = v_profile.user_id
      limit 1
    ) into v_has_hist;

    if v_has_hist then
      continue;
    end if;

    -- Insert one baseline entry per non-null content field
    -- Only fields that have _source tracking (mirrors FIELDS_WITH_SOURCE in profile-service.ts)
    if v_profile.tono_comunicacion is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'tono_comunicacion', null,
        to_jsonb(v_profile.tono_comunicacion), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.mercado_objetivo is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'mercado_objetivo', null,
        to_jsonb(v_profile.mercado_objetivo), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.propuesta_de_valor is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'propuesta_de_valor', null,
        to_jsonb(v_profile.propuesta_de_valor), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.frases_propias is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'frases_propias', null,
        to_jsonb(v_profile.frases_propias), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.ctas_efectivos is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'ctas_efectivos', null,
        to_jsonb(v_profile.ctas_efectivos), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.objeciones_frecuentes is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'objeciones_frecuentes', null,
        to_jsonb(v_profile.objeciones_frecuentes), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

    if v_profile.historia_personal is not null then
      insert into public.agent_intel_profile_history
        (user_id, campo, valor_anterior, valor_nuevo, source_type, origen, motivo)
      values (v_profile.user_id, 'historia_personal', null,
        to_jsonb(v_profile.historia_personal), 'declarado', 'migration_backfill',
        'Dato existente antes de Phase 14 — migración automática de historial');
      v_count := v_count + 1;
    end if;

  end loop;

  return v_count;
end;
$$;

-- Run backfill immediately on migration (for existing users)
-- This call is idempotent — safe to run multiple times
select public.backfill_intel_profile_history();

-- ─── PERFORMANCE INDEXES ──────────────────────────────────────────────────────
-- Optimized for the Performance Dashboard queries

-- ai_usage: fast monthly aggregations
create index if not exists idx_ai_usage_user_periodo_modulo
  on public.ai_usage(user_id, periodo_mes, modulo);

-- contenidos: fast dashboard queries
create index if not exists idx_contenidos_user_status_date
  on public.contenidos(user_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_contenidos_user_producto
  on public.contenidos(user_id, producto)
  where deleted_at is null;

-- compliance_logs: fast risk level aggregations
create index if not exists idx_compliance_user_risk_date
  on public.compliance_logs(user_id, risk_level, created_at desc);

-- objection_responses: fast tipo+product aggregations
create index if not exists idx_objections_user_tipo_util
  on public.objection_responses(user_id, objecion_tipo, fue_util);

-- ─── TABLE: aggregator_cron_config ────────────────────────────────────────────
-- Controls when the Evidence Aggregator runs automatically.
-- Separate from aggregator_config (thresholds) to keep concerns separated.

create table if not exists public.aggregator_cron_config (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references public.profiles(id) on delete cascade,
  -- null user_id = global default
  enabled         boolean not null default true,
  frequency       text not null default 'weekly'
    check (frequency in ('daily','weekly','biweekly','manual')),
  day_of_week     integer not null default 1  -- 1=Monday
    check (day_of_week between 0 and 6),
  hour_utc        integer not null default 9
    check (hour_utc between 0 and 23),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Seed global default
insert into public.aggregator_cron_config (user_id, frequency, day_of_week, hour_utc)
values (null, 'weekly', 1, 9)
on conflict (user_id) do nothing;

alter table public.aggregator_cron_config enable row level security;
create policy "Users can manage their own cron config"
  on public.aggregator_cron_config for all using (auth.uid() = user_id or user_id is null);
