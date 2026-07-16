-- ═══════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 003: Brand Builder Full Schema
--
-- This migration extends two existing tables and creates one new table.
-- Design principle: Brand Builder is the WRITE interface.
-- agent_intelligence_profiles is the READ interface for the AI.
-- No data duplication — they are the same data, different views.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTEND: brand_kits ───────────────────────────────────────────────────────
-- Adds all visual identity fields beyond basic colors

alter table public.brand_kits
  -- Professional identity
  add column if not exists nombre_comercial        text,
  add column if not exists nombre_agencia          text,
  add column if not exists anos_experiencia        smallint,
  add column if not exists certificaciones         text[],
  add column if not exists estados_licencia        text[],    -- ['FL', 'TX', 'CA']
  add column if not exists numero_licencia         text,

  -- Visual identity
  add column if not exists logo_variante_blanca_url text,     -- White version of logo
  add column if not exists logo_variante_oscura_url text,     -- Dark version of logo
  add column if not exists logo_icono_url          text,      -- Icon-only version
  add column if not exists tipografia_principal    text,      -- Font name
  add column if not exists tipografia_secundaria   text,
  add column if not exists color_acento            text,      -- Third brand color
  add column if not exists estilo_grafico          text,      -- 'moderno', 'clasico', 'minimalista', 'vibrante'
  add column if not exists estilo_fotografico      text,      -- 'profesional', 'casual', 'lifestyle', 'educativo'

  -- Photos
  add column if not exists foto_perfil_url         text,      -- Professional headshot
  add column if not exists fotos_adicionales_urls  text[],

  -- Social networks (complete)
  add column if not exists facebook_url            text,
  add column if not exists tiktok_handle           text,
  add column if not exists linkedin_url            text,
  add column if not exists youtube_url             text,
  add column if not exists pinterest_url           text,
  add column if not exists whatsapp_business       text,      -- Phone number
  add column if not exists calendly_url            text,
  add column if not exists sitio_web               text;

-- ─── EXTEND: agent_intelligence_profiles ─────────────────────────────────────
-- Adds the deep identity fields that Brand Builder captures

alter table public.agent_intelligence_profiles
  -- Professional identity (Phase 4: Brand Builder)
  add column if not exists historia_profesional    text,      -- Career story
  add column if not exists historia_personal       text,      -- Personal story / why insurance
  add column if not exists mision                  text,      -- Professional mission statement
  add column if not exists vision                  text,      -- 3-5 year vision
  add column if not exists valores                 text[],    -- ['honestidad', 'familia', 'servicio']
  add column if not exists diferenciadores         text[],    -- What makes this agent unique

  -- Voice (expanded)
  add column if not exists tipo_humor              text,      -- 'ninguno', 'ligero', 'frecuente'
  add column if not exists nivel_emocional         text,      -- 'racional', 'equilibrado', 'emocional'
  add column if not exists usa_historias           boolean not null default true,
  add column if not exists usa_estadisticas        boolean not null default false,

  -- Market (expanded)
  add column if not exists cliente_ideal_descripcion text,   -- Free text description of ideal client
  add column if not exists nichos_secundarios      text[],
  add column if not exists problemas_que_resuelve  text[],
  add column if not exists metas_negocio           jsonb,    -- {meta_corto_plazo, meta_largo_plazo, ...}

  -- Content performance (from other modules — Phase 5+)
  add column if not exists fuente_leads_principal  text,     -- 'instagram', 'referidos', 'facebook', etc.
  add column if not exists tasa_cierre_estimada    smallint, -- Self-reported close rate %
  add column if not exists ticket_promedio_usd     integer,  -- Average premium amount

  -- Interview metadata
  add column if not exists entrevista_completada   boolean not null default false,
  add column if not exists entrevista_fecha         timestamptz,

  -- Cross-module learning fields (Phases 5-13 will populate these)
  -- Content Studio → learns from what agent edits/keeps/deletes
  add column if not exists aprendizaje_content_studio   jsonb,  -- {edits_patrones, tipos_preferidos, ...}
  -- Objection AI → learns from which responses the agent copies
  add column if not exists aprendizaje_objection_ai     jsonb,  -- {variantes_preferidas, canal_preferido}
  -- Marketing Copilot → learns from strategy preferences
  add column if not exists aprendizaje_copilot          jsonb,
  -- Analytics → learns from content performance
  add column if not exists aprendizaje_analytics        jsonb,  -- {mejor_horario, mejor_tipo, mejor_tema}
  -- Lead Magnets → learns what lead magnets convert
  add column if not exists aprendizaje_lead_magnets     jsonb,
  -- Cliente Ideal AI → learns from personas created
  add column if not exists aprendizaje_cliente_ideal    jsonb,
  -- Video Studio → learns video preferences
  add column if not exists aprendizaje_video_studio     jsonb;

-- ─── NEW TABLE: interview_sessions ────────────────────────────────────────────
-- Stores the full conversation of each Brand Builder interview.
-- Allows resuming, reviewing, and regenerating the profile summary.
-- Keeping conversation history separate from the profile allows:
--   1. Full conversation replay for debugging
--   2. Multiple interview attempts without losing the best one
--   3. Future: re-running the interview to update specific sections

create table if not exists public.interview_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,

  -- Session state
  status                text not null default 'en_progreso'
                        check (status in ('en_progreso', 'resumen_generado', 'aprobado', 'descartado')),

  -- Full conversation history (array of {role, content, timestamp})
  conversacion          jsonb not null default '[]',

  -- Extracted data at time of summary generation
  extractos_json        jsonb,          -- {tema: texto_extraido, ...}

  -- The AI-generated summary (visible to agent)
  resumen_visible       text,

  -- Structured profile data ready to save
  datos_estructurados   jsonb,          -- Maps directly to agent_intelligence_profiles fields

  -- Temas coverage tracking
  temas_cubiertos       text[] not null default '{}',
  score_covertura       smallint not null default 0, -- % of topics covered

  -- Which session is the "active" one (only one active per user at a time)
  es_activa             boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Auto-update updated_at
create trigger set_updated_at before update on public.interview_sessions
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.interview_sessions enable row level security;

create policy "Users can manage their own interview sessions"
  on public.interview_sessions for all
  using (auth.uid() = user_id);

-- Indexes
create index idx_interview_user_active
  on public.interview_sessions(user_id)
  where es_activa = true;

create index idx_interview_user_status
  on public.interview_sessions(user_id, status);

-- ─── FUNCTION: build_agent_context ───────────────────────────────────────────
-- Returns a complete text context string for AI prompts.
-- Every AI module calls this function to get the agent's full context.
-- One function call → complete, always-current context.

create or replace function public.build_agent_context(p_user_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_profile  record;
  v_intel    record;
  v_brand    record;
  v_context  text := '';
begin
  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_intel from public.agent_intelligence_profiles where user_id = p_user_id;
  select * into v_brand from public.brand_kits where user_id = p_user_id;

  if v_profile is null then
    return 'Agente nuevo sin perfil configurado.';
  end if;

  v_context := '=== IDENTIDAD DEL AGENTE ===' || chr(10);
  v_context := v_context || 'Nombre: ' || coalesce(v_profile.nombre_completo, 'Sin nombre') || chr(10);

  if v_brand.nombre_comercial is not null then
    v_context := v_context || 'Nombre comercial: ' || v_brand.nombre_comercial || chr(10);
  end if;

  if v_brand.tagline is not null then
    v_context := v_context || 'Tagline: ' || v_brand.tagline || chr(10);
  end if;

  if v_profile.especialidades is not null then
    v_context := v_context || 'Especialidades: ' || array_to_string(v_profile.especialidades::text[], ', ') || chr(10);
  end if;

  if v_intel.mercado_objetivo is not null then
    v_context := v_context || 'Mercado objetivo: ' || v_intel.mercado_objetivo || chr(10);
  end if;

  if v_intel.ciudad_estado is not null then
    v_context := v_context || 'Ubicación: ' || v_intel.ciudad_estado || chr(10);
  end if;

  if v_intel.propuesta_de_valor is not null then
    v_context := v_context || chr(10) || '=== PROPUESTA DE VALOR ===' || chr(10);
    v_context := v_context || v_intel.propuesta_de_valor || chr(10);
  end if;

  if v_intel.tono_comunicacion is not null then
    v_context := v_context || chr(10) || '=== ESTILO DE COMUNICACIÓN ===' || chr(10);
    v_context := v_context || 'Tono: ' || v_intel.tono_comunicacion || chr(10);
  end if;

  if v_intel.nivel_formalidad is not null then
    v_context := v_context || 'Formalidad: ' || v_intel.nivel_formalidad::text || '/5' || chr(10);
  end if;

  if v_intel.frases_propias is not null then
    v_context := v_context || 'Frases características: ' || array_to_string(v_intel.frases_propias, ' | ') || chr(10);
  end if;

  if v_intel.palabras_a_evitar is not null then
    v_context := v_context || 'Palabras a evitar: ' || array_to_string(v_intel.palabras_a_evitar, ', ') || chr(10);
  end if;

  if v_intel.historia_personal is not null then
    v_context := v_context || chr(10) || '=== HISTORIA PERSONAL ===' || chr(10);
    v_context := v_context || v_intel.historia_personal || chr(10);
  end if;

  if v_intel.objeciones_frecuentes is not null then
    v_context := v_context || chr(10) || '=== OBJECIONES FRECUENTES ===' || chr(10);
    v_context := v_context || v_intel.objeciones_frecuentes::text || chr(10);
  end if;

  if v_intel.ctas_efectivos is not null then
    v_context := v_context || chr(10) || '=== CTAs EFECTIVOS ===' || chr(10);
    v_context := v_context || array_to_string(v_intel.ctas_efectivos, ' | ') || chr(10);
  end if;

  if v_brand.color_primario is not null then
    v_context := v_context || chr(10) || '=== MARCA VISUAL ===' || chr(10);
    v_context := v_context || 'Color primario: ' || v_brand.color_primario || chr(10);
    v_context := v_context || 'Color secundario: ' || coalesce(v_brand.color_secundario, 'no definido') || chr(10);
  end if;

  if v_brand.instagram_handle is not null then
    v_context := v_context || 'Instagram: ' || v_brand.instagram_handle || chr(10);
  end if;

  return v_context;
end;
$$;

-- ─── FUNCTION: calculate_intel_profile_score (updated) ───────────────────────
-- Recalculates score when any field is updated.
-- Called by a trigger after every UPDATE on agent_intelligence_profiles.

create or replace function public.calculate_intel_profile_score()
returns trigger
language plpgsql
as $$
declare
  v_score integer := 10; -- Base score for being registered
begin
  -- Tono y estilo (16 pts)
  if new.tono_comunicacion is not null then v_score := v_score + 8; end if;
  if new.propuesta_de_valor is not null then v_score := v_score + 8; end if;

  -- Mercado (16 pts)
  if new.mercado_objetivo is not null then v_score := v_score + 10; end if;
  if new.ciudad_estado is not null then v_score := v_score + 6; end if;

  -- Productos (8 pts)
  if new.productos_principales is not null and array_length(new.productos_principales, 1) > 0
    then v_score := v_score + 8; end if;

  -- Historia personal (10 pts)
  if new.historia_personal is not null and length(new.historia_personal) > 50
    then v_score := v_score + 10; end if;

  -- Historia profesional (5 pts)
  if new.historia_profesional is not null and length(new.historia_profesional) > 50
    then v_score := v_score + 5; end if;

  -- Misión y visión (5 pts)
  if new.mision is not null then v_score := v_score + 3; end if;
  if new.vision is not null then v_score := v_score + 2; end if;

  -- Objeciones (15 pts)
  if new.objeciones_frecuentes is not null and jsonb_array_length(new.objeciones_frecuentes) > 0
    then v_score := v_score + 15; end if;

  -- CTAs efectivos (10 pts)
  if new.ctas_efectivos is not null and array_length(new.ctas_efectivos, 1) > 0
    then v_score := v_score + 10; end if;

  -- Frases propias (8 pts)
  if new.frases_propias is not null and array_length(new.frases_propias, 1) > 0
    then v_score := v_score + 8; end if;

  -- Palabras a evitar (4 pts)
  if new.palabras_a_evitar is not null and array_length(new.palabras_a_evitar, 1) > 0
    then v_score := v_score + 4; end if;

  -- Cliente ideal (5 pts)
  if new.cliente_ideal_descripcion is not null then v_score := v_score + 5; end if;

  -- Valores (3 pts)
  if new.valores is not null and array_length(new.valores, 1) > 0
    then v_score := v_score + 3; end if;

  new.score_perfil_completitud := least(v_score, 100);
  return new;
end;
$$;

-- Attach the scoring trigger if not exists
drop trigger if exists calc_intel_score on public.agent_intelligence_profiles;
create trigger calc_intel_score
  before insert or update on public.agent_intelligence_profiles
  for each row execute function public.calculate_intel_profile_score();
