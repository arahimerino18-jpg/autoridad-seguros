-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 008: Phase 9 Onboarding + Pricing
--
-- 1. Extend profiles for 5-step onboarding tracking
-- 2. first_value_generated_at — activation event timestamp
-- 3. plan_limits: add human-readable feature descriptions
-- 4. Deprecation marker for old 3-step wizard fields
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── EXTEND: profiles — 5-step onboarding ────────────────────────────────────
-- Old: onboarding_step (1-3), onboarding_done (boolean)
-- New: onboarding_step (1-5), onboarding_completed (boolean, renamed), first_value_generated_at

alter table public.profiles
  -- Extend step range to 5
  drop constraint if exists profiles_onboarding_step_check,

  -- Activation event: timestamp of first AI-generated content during onboarding
  add column if not exists first_value_generated_at  timestamptz,

  -- Alias for cleaner semantics (onboarding_done is preserved for backward compat)
  add column if not exists onboarding_completed      boolean not null default false,

  -- Track which interview session was used during onboarding
  add column if not exists onboarding_interview_id   uuid references public.interview_sessions(id) on delete set null,

  -- Last step the user completed (0 = not started, 5 = all done)
  add column if not exists onboarding_last_step      smallint not null default 0;

-- Re-add check constraint with expanded range
alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step between 0 and 5);

-- Backfill: sync old onboarding_done → new onboarding_completed for existing users
update public.profiles
set
  onboarding_completed = onboarding_done,
  onboarding_last_step = case when onboarding_done then 5 else onboarding_step end
where true;

-- ─── EXTEND: plan_limits — feature descriptions for pricing page ──────────────
-- Single source of truth for what each plan includes/excludes.
-- Pricing page reads this table — no hardcoded plan features in components.

alter table public.plan_limits
  add column if not exists nombre_plan          text,
  add column if not exists descripcion_plan     text,
  add column if not exists caracteristicas      jsonb default '[]'::jsonb,
  add column if not exists restricciones        jsonb default '[]'::jsonb,
  add column if not exists badge_texto          text,   -- e.g. 'Más popular'
  add column if not exists badge_color          text,   -- e.g. 'gold'
  add column if not exists orden_display        integer not null default 1,
  add column if not exists max_objection_ai_mes integer not null default 15;  -- Phase 8 Objection AI limit

-- Update starter
update public.plan_limits set
  nombre_plan      = 'Starter',
  descripcion_plan = 'Para agentes que están empezando a construir su autoridad digital.',
  caracteristicas  = '[
    "30 piezas de contenido por mes",
    "10 sesiones de Marketing Copilot",
    "15 análisis de objeciones (Objection AI)",
    "Brand Builder completo",
    "Cliente Ideal AI",
    "Soporte por email"
  ]'::jsonb,
  restricciones    = '[
    "Sin Video Studio",
    "Sin publicación directa a redes",
    "Sin acceso prioritario a nuevas funciones"
  ]'::jsonb,
  badge_texto      = null,
  badge_color      = null,
  orden_display    = 1,
  max_objection_ai_mes = 15
where plan = 'starter';

-- Update pro
update public.plan_limits set
  nombre_plan      = 'Pro',
  descripcion_plan = 'Para agentes en crecimiento que quieren dominar su mercado.',
  caracteristicas  = '[
    "100 piezas de contenido por mes",
    "50 sesiones de Marketing Copilot",
    "60 análisis de objeciones (Objection AI)",
    "Video Studio incluido",
    "20 imágenes generadas por mes",
    "Teleprompter profesional",
    "Soporte prioritario"
  ]'::jsonb,
  restricciones    = '[
    "Sin publicación directa a redes"
  ]'::jsonb,
  badge_texto      = 'Más popular',
  badge_color      = 'gold',
  orden_display    = 2,
  max_objection_ai_mes = 60
where plan = 'pro';

-- Update elite
update public.plan_limits set
  nombre_plan      = 'Elite',
  descripcion_plan = 'Para agentes top producers que escalan sin límites.',
  caracteristicas  = '[
    "Contenido ilimitado",
    "Copilot ilimitado",
    "Objection AI ilimitado",
    "Video Studio premium",
    "100 imágenes por mes",
    "Publicación directa a redes sociales",
    "Acceso anticipado a todas las funciones",
    "Soporte VIP"
  ]'::jsonb,
  restricciones    = '[]'::jsonb,
  badge_texto      = 'Elite',
  badge_color      = 'navy',
  orden_display    = 3,
  max_objection_ai_mes = -1
where plan = 'elite';

-- ─── ANALYTICS: onboarding event types ───────────────────────────────────────
-- These are tracked as analytics_events.tipo_evento values.
-- Not stored as an enum to allow future extension without migrations.
-- Expected values:
--   'onboarding_iniciado'
--   'onboarding_paso_1_completado' .. 'onboarding_paso_5_completado'
--   'onboarding_completado'
--   'onboarding_abandonado'
--   'onboarding_entrevista_omitida'
--   'first_value_generated'
-- Documented here for reference — no schema change needed.

comment on column public.profiles.first_value_generated_at
  is 'Timestamp of the first AI-generated content produced during onboarding (activation event).';

comment on column public.profiles.onboarding_completed
  is 'True when the user has completed the 5-step onboarding flow. Replaces onboarding_done semantically.';
