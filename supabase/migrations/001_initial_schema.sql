a-- ═══════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 001: Complete Schema
-- Run this in the Supabase SQL Editor or via supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- For full-text search

-- ─── CUSTOM TYPES / ENUMS ────────────────────────────────────────────────────
create type plan_tier as enum ('starter', 'pro', 'elite');
create type subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'paused'
);
create type insurance_product as enum (
  'medicare', 'aca', 'iul', 'final_expense',
  'life', 'mortgage', 'general'
);
create type social_platform as enum (
  'instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'whatsapp'
);
create type content_type as enum (
  'post', 'carousel', 'reel', 'story', 'email', 'sms', 'whatsapp'
);
create type content_goal as enum (
  'educate', 'connect', 'convert', 'retain', 'referral'
);
create type content_status as enum (
  'draft', 'scheduled', 'published', 'archived'
);
create type app_module as enum (
  'content_studio', 'marketing_copilot', 'video_studio',
  'objection_ai', 'compliance_center', 'lead_magnet',
  'analytics', 'agent_video_ai'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 1: IDENTITY
-- Tables: profiles, brand_kits
-- Status: ACTIVE in MVP
-- ═══════════════════════════════════════════════════════════════════════════

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  nombre_completo text not null default '',
  foto_url        text,
  telefono        text,
  estado_usa      text not null default '',
  especialidades  insurance_product[] not null default '{}',
  plan_tier       plan_tier not null default 'starter',
  score_autoridad smallint check (score_autoridad between 0 and 100),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 3),
  onboarding_done boolean not null default false,
  referido_por    uuid references public.profiles(id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.brand_kits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade unique,
  logo_url         text,
  color_primario   text not null default '#1B2E6B',
  color_secundario text not null default '#D4A017',
  bio_instagram    text,
  tagline          text,
  tono_de_voz      text,
  instagram_handle text,
  score_completitud smallint not null default 0 check (score_completitud between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 2: INTELLIGENCE
-- Tables: buyer_personas, market_insights
-- Status: INACTIVE — created for schema completeness, used in Fase 3
-- ═══════════════════════════════════════════════════════════════════════════

create table public.buyer_personas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  nombre          text not null,
  edad_min        smallint,
  edad_max        smallint,
  origen_cultural text,
  pain_points     text[],
  objeciones      text[],
  canales_pref    social_platform[],
  es_activo       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.market_insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  contenido   jsonb not null default '{}',
  producto    insurance_product,
  es_global   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 3: CONTENT
-- Tables: contenidos, content_templates, content_calendars
-- Status: contenidos ACTIVE in MVP, others INACTIVE
-- ═══════════════════════════════════════════════════════════════════════════

create table public.contenidos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  tipo                content_type not null,
  producto            insurance_product not null,
  plataforma          social_platform not null,
  objetivo            content_goal not null default 'educate',
  titulo              text not null default '',
  cuerpo              text not null,
  cuerpo_editado      text,
  hashtags            text[],
  status              content_status not null default 'draft',
  compliance_revisado boolean not null default false,
  compliance_log_id   uuid,
  publicar_en         timestamptz,
  buyer_persona_id    uuid references public.buyer_personas(id),
  tokens_total        integer,
  es_favorito         boolean not null default false,
  -- Content Studio extended fields
  slides_json         jsonb,
  segmentos_json      jsonb,
  subject_email       text,
  preview_text_email  text,
  caracteres_sms      smallint,
  segmentos_sms       smallint,
  tono_generacion     text check (tono_generacion in ('educativo', 'emocional', 'urgencia')),
  instruccion_extra   text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.content_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  tipo        content_type not null,
  producto    insurance_product,
  titulo      text not null,
  estructura  jsonb not null default '{}',
  es_global   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.content_calendars (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  contenido_id    uuid references public.contenidos(id) on delete set null,
  fecha_programada timestamptz not null,
  plataforma      social_platform not null,
  status          text not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 4: TRAINING
-- Tables: simulation_sessions, simulation_messages, emotional_stories,
--         objection_library, conversation_analyses
-- Status: INACTIVE — created for schema completeness, used in Fase 3
-- ═══════════════════════════════════════════════════════════════════════════

create table public.simulation_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  producto              insurance_product not null,
  perfil_prospecto_json jsonb not null default '{}',
  dificultad            smallint not null default 2 check (dificultad between 1 and 4),
  historial_mensajes    jsonb not null default '[]',
  objeciones_detectadas text[],
  reporte_ia            jsonb,
  score_global          smallint check (score_global between 0 and 100),
  score_dimension_json  jsonb,
  completada            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.emotional_stories (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete cascade,
  titulo                text not null,
  objecion_objetivo     text not null,
  producto              insurance_product not null,
  version_larga         text not null,
  frase_transicion_larga text not null,
  version_corta         text not null,
  frase_transicion_corta text not null,
  pregunta_de_anclaje   text not null,
  resultado_medible     text not null,
  perfil_cultural       text[],
  veces_usada           integer not null default 0,
  es_global             boolean not null default false,
  created_at            timestamptz not null default now()
);

create table public.objection_library (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  categoria           text not null,
  producto            insurance_product not null,
  titulo              text not null,
  objecion_ejemplo    text not null,
  variantes_texto     text[] not null default '{}',
  respuestas_json     jsonb not null default '{}',
  perfiles_culturales text[],
  canal               text[],
  dificultad          smallint not null default 2,
  frecuencia_reportada smallint not null default 3,
  veces_usada         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.conversation_analyses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  tipo_input            text not null check (tipo_input in ('transcripcion', 'audio')),
  audio_url             text,
  transcripcion         text not null,
  resultado_analisis    jsonb,
  objeciones_detectadas text[],
  patron_principal      text,
  score_general         smallint check (score_general between 0 and 100),
  duracion_minutos      smallint,
  created_at            timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 5: OPERATIONS
-- Tables: compliance_logs, ai_usage, objection_sessions, analytics_events
-- Status: compliance_logs, ai_usage, objection_sessions ACTIVE in MVP
-- ═══════════════════════════════════════════════════════════════════════════

create table public.compliance_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  contenido_id     uuid references public.contenidos(id) on delete set null,
  texto_revisado   text not null,
  producto         insurance_product not null,
  aprobado         boolean not null,
  score_riesgo     smallint not null check (score_riesgo between 0 and 100),
  problemas        jsonb,
  texto_corregido  text,
  modelo_ia        text not null default 'claude-sonnet-4-6',
  regulaciones_ref text[],
  created_at       timestamptz not null default now()
  -- Intentionally no updated_at — compliance logs are immutable
);

create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  modulo        app_module not null,
  operacion     text not null,
  tokens_total  integer not null default 0,
  costo_usd     numeric(10, 6) not null default 0,
  fue_cacheado  boolean not null default false,
  periodo_mes   text not null, -- 'YYYY-MM-01'
  contenido_id  uuid references public.contenidos(id) on delete set null,
  created_at    timestamptz not null default now()
  -- Intentionally no updated_at — usage logs are immutable
);

create table public.objection_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  objecion_ingresada    text not null,
  categoria             text not null,
  canal                 text not null check (canal in ('llamada', 'whatsapp', 'presencial')),
  respuestas_generadas  jsonb,
  fue_cacheado          boolean not null default false,
  created_at            timestamptz not null default now()
  -- Intentionally no updated_at — sessions are immutable
);

create table public.analytics_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  tipo_evento  text not null,
  modulo       app_module,
  contenido_id uuid references public.contenidos(id) on delete set null,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
  -- Intentionally no updated_at — events are immutable
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DOMAIN 6: BILLING
-- Tables: subscriptions, plan_limits
-- Status: ACTIVE in MVP (billing integrated from day 1)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade unique,
  stripe_customer_id      text not null,
  stripe_subscription_id  text unique,
  plan                    plan_tier not null default 'starter',
  status                  subscription_status not null default 'active',
  periodo_fin             timestamptz,
  trial_fin               timestamptz,
  ciclo                   text check (ciclo in ('monthly', 'annual')),
  precio_usd              numeric(10, 2),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.plan_limits (
  id                          uuid primary key default gen_random_uuid(),
  plan                        plan_tier not null unique,
  max_contenidos_mes          integer not null,   -- -1 = unlimited
  max_copilot_mes             integer not null,
  max_compliance_mes          integer not null,
  max_imagenes_mes            integer not null,
  tiene_video_studio          boolean not null default false,
  tiene_publicacion_directa   boolean not null default false,
  precio_mensual_usd          numeric(10, 2) not null,
  precio_anual_usd            numeric(10, 2) not null,
  created_at                  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA: Plan Limits
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.plan_limits
  (plan, max_contenidos_mes, max_copilot_mes, max_compliance_mes,
   max_imagenes_mes, tiene_video_studio, tiene_publicacion_directa,
   precio_mensual_usd, precio_anual_usd)
values
  ('starter', 30,   10,  15,  0,    false, false, 27.00,  270.00),
  ('pro',      100,  50,  50,  20,   true,  false, 57.00,  570.00),
  ('elite',    -1,   -1,  -1,  100,  true,  true,  97.00,  970.00);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES — Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles
create index idx_profiles_plan_tier on public.profiles(plan_tier);
create index idx_profiles_onboarding on public.profiles(onboarding_done) where onboarding_done = false;

-- contenidos — the most-queried table
create index idx_contenidos_user_created on public.contenidos(user_id, created_at desc) where deleted_at is null;
create index idx_contenidos_user_producto on public.contenidos(user_id, producto) where deleted_at is null;
create index idx_contenidos_favoritos on public.contenidos(user_id) where es_favorito = true;
create index idx_contenidos_status on public.contenidos(user_id, status) where deleted_at is null;
create index idx_contenidos_programados on public.contenidos(publicar_en) where publicar_en is not null and status = 'scheduled';

-- compliance_logs
create index idx_compliance_user on public.compliance_logs(user_id, created_at desc);

-- ai_usage — billing and rate limiting
create index idx_ai_usage_user_periodo on public.ai_usage(user_id, periodo_mes);
create index idx_ai_usage_modulo on public.ai_usage(user_id, modulo, periodo_mes);

-- objection_sessions
create index idx_objection_user on public.objection_sessions(user_id, created_at desc);

-- analytics_events
create index idx_analytics_user_tipo on public.analytics_events(user_id, tipo_evento, created_at desc);

-- subscriptions
create index idx_subscriptions_stripe_customer on public.subscriptions(stripe_customer_id);
create index idx_subscriptions_status on public.subscriptions(status);

-- Full-text search on contenidos
create index idx_contenidos_fts on public.contenidos
  using gin(to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(cuerpo, '')));

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS — Automation
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at on any UPDATE
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.brand_kits
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.contenidos
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- Auto-create profile and brand_kit when a new user registers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Create the profile
  insert into public.profiles (id, email, nombre_completo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre_completo', '')
  );

  -- Create the brand kit with defaults
  insert into public.brand_kits (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- The security perimeter of the database.
-- Rule: every user can only see and modify their own data.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.brand_kits enable row level security;
alter table public.buyer_personas enable row level security;
alter table public.market_insights enable row level security;
alter table public.contenidos enable row level security;
alter table public.content_templates enable row level security;
alter table public.content_calendars enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.emotional_stories enable row level security;
alter table public.objection_library enable row level security;
alter table public.conversation_analyses enable row level security;
alter table public.compliance_logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.objection_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_limits enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────────────
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ─── brand_kits ──────────────────────────────────────────────────────────────
create policy "Users can manage their own brand kit"
  on public.brand_kits for all using (auth.uid() = user_id);

-- ─── buyer_personas ──────────────────────────────────────────────────────────
create policy "Users can manage their own buyer personas"
  on public.buyer_personas for all using (auth.uid() = user_id);

-- ─── contenidos ──────────────────────────────────────────────────────────────
create policy "Users can manage their own content"
  on public.contenidos for all using (auth.uid() = user_id);

-- ─── content_templates ───────────────────────────────────────────────────────
create policy "Users can view global templates and their own"
  on public.content_templates for select
  using (es_global = true or auth.uid() = user_id);

create policy "Users can manage their own templates"
  on public.content_templates for insert with check (auth.uid() = user_id);

create policy "Users can update their own templates"
  on public.content_templates for update using (auth.uid() = user_id);

-- ─── content_calendars ───────────────────────────────────────────────────────
create policy "Users can manage their own calendar"
  on public.content_calendars for all using (auth.uid() = user_id);

-- ─── simulation_sessions ─────────────────────────────────────────────────────
create policy "Users can manage their own simulations"
  on public.simulation_sessions for all using (auth.uid() = user_id);

-- ─── emotional_stories ───────────────────────────────────────────────────────
create policy "Users can view global stories and their own"
  on public.emotional_stories for select
  using (es_global = true or auth.uid() = user_id);

create policy "Users can manage their own stories"
  on public.emotional_stories for insert with check (auth.uid() = user_id);

-- ─── objection_library ───────────────────────────────────────────────────────
create policy "Everyone can view the objection library"
  on public.objection_library for select to authenticated using (true);

-- ─── conversation_analyses ───────────────────────────────────────────────────
create policy "Users can manage their own analyses"
  on public.conversation_analyses for all using (auth.uid() = user_id);

-- ─── compliance_logs (INSERT-only for users, no UPDATE/DELETE) ───────────────
create policy "Users can view their own compliance logs"
  on public.compliance_logs for select using (auth.uid() = user_id);

create policy "Users can create compliance logs"
  on public.compliance_logs for insert with check (auth.uid() = user_id);

-- ─── ai_usage (INSERT-only, immutable) ───────────────────────────────────────
create policy "Users can view their own AI usage"
  on public.ai_usage for select using (auth.uid() = user_id);

create policy "Users can create AI usage records"
  on public.ai_usage for insert with check (auth.uid() = user_id);

-- ─── objection_sessions ──────────────────────────────────────────────────────
create policy "Users can manage their own objection sessions"
  on public.objection_sessions for all using (auth.uid() = user_id);

-- ─── analytics_events (INSERT-only) ─────────────────────────────────────────
create policy "Users can view their own analytics"
  on public.analytics_events for select using (auth.uid() = user_id);

create policy "Users can create analytics events"
  on public.analytics_events for insert with check (auth.uid() = user_id);

-- ─── subscriptions ───────────────────────────────────────────────────────────
create policy "Users can view their own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- Note: subscriptions are only written by Stripe webhooks via service_role
-- No user-level INSERT/UPDATE/DELETE policies

-- ─── plan_limits (public read-only) ──────────────────────────────────────────
create policy "Anyone can view plan limits"
  on public.plan_limits for select using (true);

-- ─── market_insights ─────────────────────────────────────────────────────────
create policy "Users can view global insights and their own"
  on public.market_insights for select
  using (es_global = true or auth.uid() = user_id);

create policy "Users can create their own insights"
  on public.market_insights for insert with check (auth.uid() = user_id);
