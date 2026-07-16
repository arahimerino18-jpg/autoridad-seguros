-- ═══════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 005: Phase 7 Schema
--
-- 1. output_json on contenidos — stores structured output for library preview
-- 2. ideal_client_profile on agent_intelligence_profiles — Phase 7 Client AI
-- 3. GIN index on output_json for Phase 13 full-text search
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTEND: contenidos ───────────────────────────────────────────────────────

alter table public.contenidos
  -- Full structured JSON output — enables library preview replay
  add column if not exists output_json              jsonb,
  -- Phase 7: track publication state
  add column if not exists fue_publicado            boolean not null default false,
  add column if not exists fecha_publicado          timestamptz,
  add column if not exists canal_publicacion        text,
  -- Phase 7: multi-channel adaptation tracking
  add column if not exists contenido_origen_id      uuid references public.contenidos(id),
  add column if not exists es_adaptacion            boolean not null default false,
  -- Phase 9: series grouping
  add column if not exists serie_id                 uuid,
  -- Phase 13: performance data
  add column if not exists engagement_json          jsonb,
  add column if not exists leads_generados          integer not null default 0;

-- GIN index on output_json for Phase 13 content search
create index if not exists idx_contenidos_output_json
  on public.contenidos using gin(output_json)
  where output_json is not null;

-- Index for library queries: user + type + date
create index if not exists idx_contenidos_library
  on public.contenidos(user_id, tipo, created_at desc)
  where deleted_at is null;

-- ─── EXTEND: agent_intelligence_profiles (ideal client) ───────────────────────

alter table public.agent_intelligence_profiles
  -- Ideal client profile (Phase 7)
  add column if not exists cliente_ideal_json        jsonb,
  -- ^ Structured IdealClientProfile object (see below for schema)
  -- Evidence types for each field — same transparency principle as Growth Engine
  add column if not exists cliente_ideal_version     integer not null default 0,
  add column if not exists cliente_ideal_fecha       timestamptz;

-- ─── IDEAL CLIENT PROFILE JSON SCHEMA (documentation) ────────────────────────
-- Stored in agent_intelligence_profiles.cliente_ideal_json
--
-- {
--   "demografico": {
--     "edad_rango": "55-70",
--     "genero": "mixto",
--     "origen": "cubano/venezolano",
--     "ubicacion": "Miami-Dade, FL",
--     "estado_civil": "casado",
--     "hijos": "adultos independientes",
--     "nivel_educacion": "secundaria o técnico",
--     "nivel_ingreso": "40k-70k USD/año",
--     "evidencia": "AGENT_DATA"
--   },
--   "psicografico": {
--     "etapa_vida": "pre-retiro o retiro temprano",
--     "prioridades": ["salud", "familia", "estabilidad"],
--     "miedos": ["perder cobertura", "gastos médicos inesperados", "ser carga para la familia"],
--     "deseos": ["tranquilidad", "plan que funcione de verdad", "agente de confianza"],
--     "nivel_conocimiento_seguros": "bajo-medio",
--     "evidencia": "HYPOTHESIS"
--   },
--   "comportamiento": {
--     "canales_preferidos": ["WhatsApp", "Facebook", "recomendaciones de amigos"],
--     "formatos_contenido": ["video educativo corto", "carrusel con pasos simples"],
--     "momento_decision": "cuando un familiar tuvo un problema médico",
--     "objeciones_principales": ["precio", "confianza en seguros", "ya tengo algo"],
--     "motivadores": ["proteger a la familia", "no depender de los hijos"],
--     "evidencia": "AGENT_DATA"
--   },
--   "comercial": {
--     "productos_relevantes": ["medicare", "final_expense"],
--     "ticket_promedio_estimado": 150,
--     "ciclo_decision_dias": 14,
--     "mejor_cta": "cita presencial o por video",
--     "evidencia": "HYPOTHESIS"
--   },
--   "mensajes": {
--     "tono_efectivo": "cálido, en español, sin términos técnicos",
--     "angulo_confianza": "agente de la comunidad que entiende su situación",
--     "frases_resonantes": ["tu salud primero", "no te quedes sin protección"],
--     "frases_a_evitar": ["deducible", "copago", "red de proveedores"],
--     "evidencia": "AGENT_DATA"
--   },
--   "meta": {
--     "generado_en": "2025-10-15T10:00:00Z",
--     "preguntas_agente": ["..."],
--     "contexto_usado": ["agent_intelligence_profiles", "brand_kits", "agent_goals"],
--     "hipotesis_pendientes": ["nivel_ingreso necesita validación", "ciclo_decision es estimado"]
--   }
-- }

-- ─── UPDATE: scoring function to include cliente_ideal_json ──────────────────

create or replace function public.calculate_intel_profile_score()
returns trigger
language plpgsql
as $$
declare
  v_score integer := 10;
begin
  if new.tono_comunicacion is not null then v_score := v_score + 8; end if;
  if new.propuesta_de_valor is not null then v_score := v_score + 8; end if;
  if new.mercado_objetivo is not null then v_score := v_score + 10; end if;
  if new.ciudad_estado is not null then v_score := v_score + 6; end if;
  if new.productos_principales is not null and array_length(new.productos_principales, 1) > 0
    then v_score := v_score + 8; end if;
  if new.historia_personal is not null and length(new.historia_personal) > 50
    then v_score := v_score + 10; end if;
  if new.historia_profesional is not null and length(new.historia_profesional) > 50
    then v_score := v_score + 5; end if;
  if new.mision is not null then v_score := v_score + 3; end if;
  if new.vision is not null then v_score := v_score + 2; end if;
  if new.objeciones_frecuentes is not null and jsonb_array_length(new.objeciones_frecuentes) > 0
    then v_score := v_score + 15; end if;
  if new.ctas_efectivos is not null and array_length(new.ctas_efectivos, 1) > 0
    then v_score := v_score + 10; end if;
  if new.frases_propias is not null and array_length(new.frases_propias, 1) > 0
    then v_score := v_score + 8; end if;
  if new.palabras_a_evitar is not null and array_length(new.palabras_a_evitar, 1) > 0
    then v_score := v_score + 4; end if;
  -- Phase 7: ideal client adds to score
  if new.cliente_ideal_descripcion is not null then v_score := v_score + 5; end if;
  if new.cliente_ideal_json is not null then v_score := v_score + 6; end if;
  if new.valores is not null and array_length(new.valores, 1) > 0
    then v_score := v_score + 3; end if;

  new.score_perfil_completitud := least(v_score, 100);
  return new;
end;
$$;
