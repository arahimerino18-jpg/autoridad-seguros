-- ═══════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 002: Agent Intelligence Profile
-- The "brain" of the AI for each agent. This table is what converts the
-- platform from a generic AI tool into a system that sounds exactly like
-- each individual agent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Agent Intelligence Profile ──────────────────────────────────────────────
-- Populated at onboarding (Phase 3), enriched by Brand Builder (Phase 4),
-- and evolved automatically by the learning job (Phase 13).

create table public.agent_intelligence_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade unique,

  -- ── Writing Style ──────────────────────────────────────────────────────────
  estilo_escritura      text,           -- 'conversacional', 'formal', 'educativo', 'inspiracional'
  tono_comunicacion     text,           -- From onboarding step 2
  nivel_formalidad      smallint        -- 1-5 scale (1=muy informal, 5=muy formal)
    check (nivel_formalidad between 1 and 5),
  usa_emojis            boolean not null default true,
  longitud_preferida    text,           -- 'corto', 'medio', 'largo'

  -- ── Voice & Personality ───────────────────────────────────────────────────
  frases_propias        text[],         -- Catchphrases the agent uses frequently
  palabras_a_evitar     text[],         -- Words/phrases to never use
  historias_personales  jsonb,          -- [{titulo, historia, cuando_usar}]
  propuesta_de_valor    text,           -- Agent's unique value proposition in their words

  -- ── Market & Products ────────────────────────────────────────────────────
  productos_principales insurance_product[],
  mercado_objetivo      text,           -- 'cubanos mayores 60', 'familias venezolanas', etc.
  ciudad_estado         text,           -- 'Miami, FL'
  idiomas               text[] not null default '{"español"}',
  comunidades           text[],         -- ['cubana', 'venezolana']

  -- ── Sales Intelligence ───────────────────────────────────────────────────
  objeciones_frecuentes jsonb,          -- [{objecion, respuesta_exitosa, categoria}]
  ctas_efectivos        text[],         -- CTAs that have worked well for this agent
  momentos_cierre       text[],         -- Phrases that have worked to close

  -- ── Content Performance ──────────────────────────────────────────────────
  tipos_contenido_preferidos content_type[],
  horarios_optimos      jsonb,          -- {instagram: ['9am', '7pm'], facebook: ['8am']}
  hashtags_recurrentes  text[],
  temas_de_alto_rendimiento text[],     -- Topics that get most engagement

  -- ── Brand ────────────────────────────────────────────────────────────────
  color_primario        text,
  color_secundario      text,
  tagline               text,
  instagram_handle      text,

  -- ── Learning Metadata ────────────────────────────────────────────────────
  total_contenidos_generados  integer not null default 0,
  total_contenidos_publicados integer not null default 0,
  total_objections_handled    integer not null default 0,
  patron_edicion_json         jsonb,   -- What the agent typically edits (learns their preferences)
  score_perfil_completitud    smallint not null default 0
    check (score_perfil_completitud between 0 and 100),
  version                     integer not null default 1,  -- For rollback capability
  ultima_actualizacion_ia     timestamptz,  -- When the AI last learned from behavior

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── Trigger: keep updated_at fresh ─────────────────────────────────────────
create trigger set_updated_at before update on public.agent_intelligence_profiles
  for each row execute function public.handle_updated_at();

-- ─── Index ───────────────────────────────────────────────────────────────────
create index idx_agent_intel_user on public.agent_intelligence_profiles(user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.agent_intelligence_profiles enable row level security;

create policy "Users can view their own intelligence profile"
  on public.agent_intelligence_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their own intelligence profile"
  on public.agent_intelligence_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert their own intelligence profile"
  on public.agent_intelligence_profiles for insert
  with check (auth.uid() = user_id);

-- ─── Trigger: auto-create intelligence profile when profile is created ───────
-- This ensures every agent always has an intelligence profile row,
-- even if it starts empty. The dashboard then prompts them to enrich it.

create or replace function public.handle_new_intelligence_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.agent_intelligence_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_intelligence_profile();

-- ─── Function: calculate profile completeness score ─────────────────────────
-- Called after enrichment actions to keep the score current.

create or replace function public.calculate_intel_profile_score(p_user_id uuid)
returns smallint language plpgsql security definer as $$
declare
  v_profile public.agent_intelligence_profiles%rowtype;
  v_score int := 0;
  v_max int := 100;
begin
  select * into v_profile
  from public.agent_intelligence_profiles
  where user_id = p_user_id;

  if not found then return 0; end if;

  -- Base fields (40 points)
  if v_profile.tono_comunicacion is not null       then v_score := v_score + 8; end if;
  if v_profile.mercado_objetivo is not null        then v_score := v_score + 8; end if;
  if v_profile.productos_principales is not null
     and array_length(v_profile.productos_principales, 1) > 0
                                                   then v_score := v_score + 8; end if;
  if v_profile.ciudad_estado is not null           then v_score := v_score + 8; end if;
  if v_profile.propuesta_de_valor is not null      then v_score := v_score + 8; end if;

  -- Sales intelligence (30 points)
  if v_profile.objeciones_frecuentes is not null
     and jsonb_array_length(v_profile.objeciones_frecuentes) > 0
                                                   then v_score := v_score + 15; end if;
  if v_profile.ctas_efectivos is not null
     and array_length(v_profile.ctas_efectivos, 1) > 0
                                                   then v_score := v_score + 15; end if;

  -- Voice (20 points)
  if v_profile.historias_personales is not null
     and jsonb_array_length(v_profile.historias_personales) > 0
                                                   then v_score := v_score + 10; end if;
  if v_profile.frases_propias is not null
     and array_length(v_profile.frases_propias, 1) > 0
                                                   then v_score := v_score + 10; end if;

  -- Brand (10 points)
  if v_profile.instagram_handle is not null        then v_score := v_score + 5; end if;
  if v_profile.tagline is not null                 then v_score := v_score + 5; end if;

  return least(v_score, v_max)::smallint;
end;
$$;
