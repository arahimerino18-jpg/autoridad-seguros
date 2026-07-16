-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 009: Phase 10
--
-- 1. compliance_logs: extend with structured risk fields (Phase 10 engine)
-- 2. onboarding_banner_seen: prevent repeat display per session (in profiles)
-- 3. settings page fields (no new tables — reuses profiles + subscriptions)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── EXTEND: compliance_logs ─────────────────────────────────────────────────
-- Existing: id, user_id, contenido_id, texto_revisado, producto, aprobado,
--           score_riesgo, problemas, texto_corregido, modelo_ia, regulaciones_ref
-- New: structured fields for Phase 10 Compliance Engine

alter table public.compliance_logs
  -- Risk level in clear terms (replaces verde/amarillo/rojo with LOW/MEDIUM/HIGH)
  add column if not exists risk_level          text check (risk_level in ('LOW','MEDIUM','HIGH')),
  -- Canal where the content will be published
  add column if not exists canal               text,
  -- Which issues were detected (structured, from deterministic + AI layers)
  add column if not exists detected_issues     jsonb default '[]'::jsonb,
  -- Whether human review was recommended
  add column if not exists requires_human_review boolean not null default false,
  -- Whether the user applied a suggested correction
  add column if not exists correction_applied  boolean,
  -- If a re-check was done after correction, link to new log
  add column if not exists recheck_log_id      uuid references public.compliance_logs(id) on delete set null,
  -- Source of the content ('content_studio' | 'manual' | 'copilot')
  add column if not exists content_source      text not null default 'content_studio',
  -- Summary of the review (human-readable)
  add column if not exists overall_summary     text,
  -- Compliance notes shown to the agent
  add column if not exists compliance_notes    text[];

-- Indexes for compliance analytics
create index if not exists idx_compliance_user_date
  on public.compliance_logs(user_id, created_at desc);

create index if not exists idx_compliance_risk
  on public.compliance_logs(user_id, risk_level)
  where risk_level is not null;

create index if not exists idx_compliance_product
  on public.compliance_logs(user_id, producto);

-- ─── EXTEND: profiles — onboarding banner ────────────────────────────────────
-- We track whether the banner was shown THIS session on the client side (sessionStorage).
-- But we need to know server-side if the user HAS seen it to avoid server flicker.
-- Since sessions are ephemeral, we use a simple date field:
-- "last time the banner was shown" — if today, don't show again.
-- Note: "once per session" is enforced client-side via sessionStorage.
-- This field is for analytics only.

alter table public.profiles
  add column if not exists onboarding_banner_last_shown_at timestamptz;

-- ─── COMPLIANCE: deterministic rules reference table ─────────────────────────
-- Stores the deterministic rule patterns used in Layer 1 of the compliance pipeline.
-- Allows future extension without code changes.
-- Seeded with initial rule set.

create table if not exists public.compliance_rules (
  id            uuid primary key default gen_random_uuid(),
  rule_id       text unique not null,  -- e.g. 'ABSOLUTE_CLAIM_GARANTIZADO'
  category      text not null,         -- e.g. 'absolute_claim'
  severity      text not null check (severity in ('LOW','MEDIUM','HIGH')),
  pattern_type  text not null check (pattern_type in ('keyword','regex','context')),
  pattern_value text not null,         -- The keyword or regex
  description   text not null,
  recommendation text not null,
  products      text[] not null default '{}', -- empty = all products
  channels      text[] not null default '{}', -- empty = all channels
  active        boolean not null default true,
  source        text not null default 'internal', -- future: 'cms', 'carrier', 'state'
  jurisdiction  text,                  -- future: 'FL', 'TX', 'federal', etc.
  effective_date date,
  created_at    timestamptz not null default now()
);

alter table public.compliance_rules enable row level security;
create policy "Public can read active compliance rules"
  on public.compliance_rules for select using (active = true);

-- ─── SEED: deterministic compliance rules ────────────────────────────────────

insert into public.compliance_rules
  (rule_id, category, severity, pattern_type, pattern_value, description, recommendation)
values

-- Absolute claims
('CLAIM_GARANTIZADO',   'absolute_claim', 'HIGH',   'keyword', 'garantizado',           'Uso de "garantizado" puede crear expectativa falsa de aprobación o cobertura.', 'Reemplaza con "puede calificar para" o "generalmente incluye".'),
('CLAIM_GARANTIZA',     'absolute_claim', 'HIGH',   'keyword', 'garantiza',             'Garantías absolutas no están permitidas en marketing de seguros.',              'Usa lenguaje condicional: "si califica" o "en la mayoría de los casos".'),
('CLAIM_GRATIS',        'absolute_claim', 'MEDIUM', 'keyword', 'completamente gratis',  'Nada en seguros es "completamente gratis" — siempre hay primas o copagos.',      'Especifica qué es sin costo adicional y bajo qué condiciones.'),
('CLAIM_SIN_COSTO',     'absolute_claim', 'MEDIUM', 'keyword', 'sin costo',             'Puede ser engañoso sin aclarar que se requiere calificación y prima.',           'Agrega: "sujeto a calificación" o especifica qué tiene costo cero.'),
('CLAIM_MEJOR',         'absolute_claim', 'MEDIUM', 'keyword', 'el mejor',              'Comparativo superlativo sin evidencia.',                                        'Usa "una de las mejores opciones" o describe el beneficio específico.'),
('CLAIM_APROBACION',    'absolute_claim', 'HIGH',   'keyword', 'aprobación garantizada','Ningún seguro puede garantizar aprobación.',                                    'Usa "sin preguntas de salud" solo si el producto realmente lo permite.'),
('CLAIM_SIN_RECHAZO',   'absolute_claim', 'HIGH',   'keyword', 'sin rechazo',           'Promesa de no rechazo puede ser incorrecta para muchos productos.',            'Verifica que el producto sea realmente guaranteed issue antes de usarlo.'),

-- Financial promises
('FIN_RENDIMIENTO',     'financial_promise', 'HIGH',   'keyword', 'rendimiento garantizado', 'IUL y otros productos indexados no garantizan rendimientos.',             'Usa "potencial de crecimiento" o "vinculado al índice" con la aclaración del piso.'),
('FIN_GANA_SIEMPRE',    'financial_promise', 'HIGH',   'keyword', 'siempre gana',         'No existe producto financiero que siempre genere ganancias.',              'Describe el mecanismo real: piso de 0% y techo ligado al índice.'),
('FIN_DUPLICA',         'financial_promise', 'HIGH',   'keyword', 'duplica tu dinero',    'Promesa de duplicación sin contexto es engañosa.',                        'Muestra proyecciones reales con escenarios ilustrativos, no promesas.'),
('FIN_RETIRO',          'financial_promise', 'MEDIUM', 'keyword', 'retiro',               'La palabra "retiro" puede confundir un seguro de vida con un plan de retiro.', 'Aclara: "valores en efectivo disponibles" o "acceso a fondos acumulados".'),

-- Medicare specific
('MED_GOVT',            'medicare_risk', 'HIGH',   'keyword', 'gobierno te da',        'Medicare no "da" beneficios — son servicios a los que califica.',               'Usa: "puede calificar para beneficios de Medicare Advantage".'),
('MED_GRATIS',          'medicare_risk', 'HIGH',   'keyword', 'medicare gratis',        'Medicare Advantage no es gratis — hay primas, copagos y deducibles.',          'Especifica "$0 prima mensual" solo si el plan lo permite, aclarando otros costos.'),
('MED_TODOS_CALIFICAN', 'medicare_risk', 'HIGH',   'keyword', 'todos califican',        'No todos califican para todos los planes de Medicare.',                        'Usa "si califica" o "disponible en tu área" con verificación previa.'),
('MED_GOBIERNO_APRUEBA','medicare_risk', 'HIGH',   'keyword', 'aprobado por el gobierno','Puede implicar endorsement gubernamental que no existe.',                   'Los planes Medicare Advantage son de aseguradoras privadas aprobadas por CMS.'),

-- Government impersonation
('GOV_LLAMA',           'government_impersonation', 'HIGH', 'keyword', 'llamamos de medicare', 'Puede crear impresión de ser empleado federal.', 'Aclara que representas a una aseguradora privada, no al gobierno.'),
('GOV_DEPARTAMENTO',    'government_impersonation', 'HIGH', 'keyword', 'departamento de',      'Puede confundirse con agencia gubernamental.',    'Usa el nombre real de tu agencia o empresa.'),

-- Fear-based selling
('FEAR_MUERTE',         'fear_selling', 'MEDIUM', 'keyword', 'cuando mueras sin seguro',  'Fear-based selling excesivo puede ser manipulativo.',                     'Reformula enfocándote en protección y tranquilidad, no en miedo.'),
('FEAR_PERDER_TODO',    'fear_selling', 'MEDIUM', 'keyword', 'perderás todo',             'Lenguaje de miedo extremo puede ser considerado coercitivo.',             'Enfoca en el beneficio de protección en lugar del miedo a la pérdida.'),

-- CTA issues
('CTA_URGENCIA',        'cta_risk', 'MEDIUM', 'keyword', 'solo por hoy',              'Urgencia artificial puede ser considerada presión indebida.',              'Si hay un plazo real (OEP/SEP), menciónalo con la fecha exacta.'),
('CTA_ULTIMA_OPORTUNIDAD', 'cta_risk', 'MEDIUM', 'keyword', 'última oportunidad',    'Urgencia falsa es una práctica cuestionable.',                            'Usa fechas reales de período de inscripción cuando aplique.'),

-- Disclosure omission
('DISC_CALIFICACION',   'disclosure_omission', 'MEDIUM', 'context', 'sujeto a calificacion', 'Contenido sobre productos que requieren underwriting debe mencionar que aplica calificación.', 'Agrega "sujeto a calificación de salud" para productos que lo requieran.'),

-- Product comparison
('COMP_SIN_EVIDENCIA',  'product_comparison', 'MEDIUM', 'keyword', 'mejor que',         'Comparación sin evidencia puede ser engañosa.',                           'Cita la fuente de la comparación o evita comparaciones directas sin sustento.')

on conflict (rule_id) do update set
  description    = excluded.description,
  recommendation = excluded.recommendation,
  severity       = excluded.severity;
