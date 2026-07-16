-- ═══════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 004: AI Growth Engine + Marketing Copilot
--
-- ARCHITECTURE PRINCIPLE: Single evolutionary architecture.
-- Phase 5 builds the Intent Engine (data we have now).
-- Phase 13 extends this SAME schema with the Performance Engine.
-- Nothing gets rewritten — columns get populated.
--
-- Every recommendation stores its evidence_type so the UI can
-- distinguish: AGENT_DATA | SEASONALITY | HYPOTHESIS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── TABLE: agent_goals ───────────────────────────────────────────────────────
-- Monthly objectives configured by the agent.
-- The Growth Engine uses these to orient all recommendations.

create table public.agent_goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  mes                   text not null,           -- 'YYYY-MM'
  meta_leads            integer,
  meta_clientes         integer,                 -- actual clients signed
  producto_prioritario  text,                    -- insurance_product
  objetivo_principal    text not null default 'leads'
                        check (objetivo_principal in ('leads', 'awareness', 'autoridad', 'referidos')),
  tiempo_disponible_min integer not null default 30,  -- minutes/day for content
  notas                 text,
  -- Phase 13 extension point: track goal attainment
  leads_obtenidos       integer not null default 0,
  clientes_cerrados     integer not null default 0,
  meta_alcanzada        boolean,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(user_id, mes)
);

create trigger set_updated_at before update on public.agent_goals
  for each row execute function public.handle_updated_at();

alter table public.agent_goals enable row level security;
create policy "Users manage their own goals"
  on public.agent_goals for all using (auth.uid() = user_id);

create index idx_goals_user_mes on public.agent_goals(user_id, mes);

-- ─── TABLE: insurance_calendar ───────────────────────────────────────────────
-- Seed data: industry events, enrollment periods, Hispanic holidays.
-- The Growth Engine uses proximity to these events to contextualize
-- all recommendations with temporal intelligence.

create table public.insurance_calendar (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  tipo                  text not null
                        check (tipo in ('aep','oep','sep','medicare','aca','vida',
                                        'gastos_finales','festivo_hispano','industria')),
  fecha_inicio          date not null,
  fecha_fin             date not null,
  recurrente_anual      boolean not null default true,
  productos_relevantes  text[] not null default '{}',
  descripcion           text,
  importancia           smallint not null default 3 check (importancia between 1 and 5),
  consejo_marketing     text,       -- Specific tip for this period
  audiencia_objetivo    text,       -- Which market segment cares most
  created_at            timestamptz not null default now()
);

-- Public read — all agents see the same calendar
alter table public.insurance_calendar enable row level security;
create policy "Anyone can read insurance calendar"
  on public.insurance_calendar for select using (true);

create index idx_calendar_fechas on public.insurance_calendar(fecha_inicio, fecha_fin);
create index idx_calendar_tipo on public.insurance_calendar(tipo);

-- ─── TABLE: growth_engine_outputs ────────────────────────────────────────────
-- Stores every recommendation the AI Growth Engine generates.
-- CRITICAL for Phase 13: this is how the engine measures whether
-- its own recommendations worked and improves future ones.
--
-- Phase 5: stores recommendations, tracks if agent acted on them.
-- Phase 13: adds outcome tracking (did the recommended content get leads?).

create table public.growth_engine_outputs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,

  -- Classification
  tipo                  text not null
                        check (tipo in ('diario','semanal','mensual','oportunidad','alerta')),
  modo_origen           text,                    -- which copilot mode triggered this
  periodo               text,                    -- 'YYYY-MM-DD' for daily, 'YYYY-WXX' for weekly

  -- The recommendation itself (structured for display)
  titulo                text not null,
  que_recomienda        text not null,           -- What
  por_que               text not null,           -- Why
  objetivo_estrategico  text not null,           -- Which strategic goal
  accion_concreta       text not null,           -- Exact action to take

  -- Evidence transparency (what data backed this recommendation)
  evidence_type         text not null
                        check (evidence_type in (
                          'AGENT_DATA',          -- Based on agent profile/history
                          'SEASONALITY',         -- Based on calendar/time of year
                          'HYPOTHESIS',          -- Strategic hypothesis to validate
                          'PERFORMANCE'          -- Phase 13: based on engagement data
                        )),
  evidence_summary      text,                    -- Brief explanation of the evidence

  -- Context snapshot at generation time (for Phase 13 comparison)
  context_snapshot      jsonb,                   -- Key metrics at time of recommendation
  calendario_eventos    jsonb,                   -- Upcoming events considered

  -- Agent interaction tracking
  fue_vista             boolean not null default false,
  fue_ejecutada         boolean not null default false,   -- Agent clicked "generate"
  fue_descartada        boolean not null default false,
  contenido_generado_id uuid references public.contenidos(id),  -- If acted upon

  -- Phase 13 extension: outcome tracking
  -- These columns exist now but are null until Phase 13 populates them
  outcome_leads         integer,                 -- Leads attributed to this recommendation
  outcome_engagement    jsonb,                   -- Engagement metrics of resulting content
  recommendation_score  smallint,               -- How good was this rec? (1-5, Phase 13)
  validacion_resultado  text,                    -- Was the hypothesis confirmed?

  created_at            timestamptz not null default now()
);

alter table public.growth_engine_outputs enable row level security;
create policy "Users view their own growth outputs"
  on public.growth_engine_outputs for all using (auth.uid() = user_id);

create index idx_growth_user_tipo on public.growth_engine_outputs(user_id, tipo, created_at desc);
create index idx_growth_user_periodo on public.growth_engine_outputs(user_id, periodo);
create index idx_growth_not_seen on public.growth_engine_outputs(user_id)
  where fue_vista = false and fue_descartada = false;

-- ─── TABLE: copilot_sessions ─────────────────────────────────────────────────
-- Stores Marketing Copilot conversations.
-- Mode 5 (Chat Libre) persists history here.
-- A session summary is generated on close for continuity.

create table public.copilot_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  modo                  text not null
                        check (modo in ('estratega','analista','campana',
                                        'posicionamiento','chat')),
  parametros_modo       jsonb,                   -- Form params for structured modes
  conversacion          jsonb not null default '[]',
  resumen_sesion        text,                    -- Generated by Claude on session close
  tokens_usados         integer not null default 0,
  -- Phase 13: link sessions to outcomes
  growth_output_id      uuid references public.growth_engine_outputs(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger set_updated_at before update on public.copilot_sessions
  for each row execute function public.handle_updated_at();

alter table public.copilot_sessions enable row level security;
create policy "Users manage their own copilot sessions"
  on public.copilot_sessions for all using (auth.uid() = user_id);

create index idx_copilot_user_modo on public.copilot_sessions(user_id, modo, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA: insurance_calendar
-- The temporal intelligence of the AI Growth Engine.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.insurance_calendar
  (nombre, tipo, fecha_inicio, fecha_fin, recurrente_anual,
   productos_relevantes, descripcion, importancia,
   consejo_marketing, audiencia_objetivo)
values

-- ── MEDICARE ───────────────────────────────────────────────────────────────
('AEP — Annual Enrollment Period', 'aep',
 '2025-10-15', '2025-12-07', true,
 '{"medicare"}',
 'El período más importante del año para Medicare. Adultos mayores pueden cambiar o inscribirse en planes Medicare Advantage y Part D.',
 5,
 'Empieza a publicar contenido educativo 3-4 semanas antes. Semana 1: educación sobre elegibilidad. Semana 2: comparación de planes. Semana 3-6: urgencia y CTA de cita. La semana del 7 de diciembre es la de mayor conversión.',
 'Adultos 65+ y personas con discapacidad'),

('OEP — Open Enrollment Period Medicare', 'oep',
 '2026-01-01', '2026-03-31', true,
 '{"medicare"}',
 'Período donde los beneficiarios de Medicare Advantage pueden hacer un cambio de plan.',
 4,
 'Menor intensidad que el AEP pero ideal para contactar clientes insatisfechos con su plan actual. Contenido enfocado en comparaciones y beneficios adicionales.',
 'Adultos 65+ con Medicare Advantage activo'),

('Medicare SEP — Special Enrollment Period', 'sep',
 '2025-01-01', '2025-12-31', true,
 '{"medicare"}',
 'Períodos de inscripción especiales por eventos de vida: mudanza, pérdida de cobertura, cambio de estado civil.',
 3,
 'Crear contenido evergreen sobre SEP. Cualquier cambio de vida importante activa un SEP. Educar a tu audiencia sobre cuándo pueden inscribirse fuera de los períodos regulares.',
 'Adultos 65+ con cambios de vida recientes'),

-- ── ACA / SALUD ────────────────────────────────────────────────────────────
('OEP Federal ACA', 'aca',
 '2025-11-01', '2026-01-15', true,
 '{"aca"}',
 'Período de inscripción abierta para planes de salud ACA en Healthcare.gov.',
 5,
 'Uno de los períodos más importantes para agentes de ACA. Empieza en noviembre — coincide con el AEP de Medicare. Planifica contenido dual si manejas ambos productos.',
 'Adultos 26-64 sin seguro patronal'),

('SEP ACA — Special Enrollment', 'sep',
 '2025-01-01', '2025-12-31', true,
 '{"aca"}',
 'Inscripción especial por pérdida de trabajo, matrimonio, nacimiento, mudanza.',
 3,
 'Publicar regularmente sobre eventos que activan el SEP: cambio de trabajo, nuevo bebé, matrimonio, divorcio. Son mensajes evergreen de alto valor.',
 'Adultos con cambios de vida recientes'),

-- ── VIDA / IUL ─────────────────────────────────────────────────────────────
('Temporada Alta IUL — Enero', 'vida',
 '2026-01-01', '2026-01-31', true,
 '{"iul","life","mortgage"}',
 'Enero es el mes de resoluciones. Alto interés en protección financiera y ahorro a largo plazo.',
 3,
 'Contenido sobre metas financieras del año nuevo. IUL como herramienta de ahorro + protección. Conecta con las resoluciones de la audiencia.',
 'Familias latinas 30-55 con ingresos medios'),

('Temporada Alta IUL — Noviembre', 'vida',
 '2025-11-01', '2025-11-30', true,
 '{"iul","life","mortgage"}',
 'Planeación de fin de año. Las familias piensan en legado y protección antes de Navidad.',
 3,
 'Contenido sobre proteger el legado familiar antes del nuevo año. Testimonios de familias protegidas. Urgencia: "¿Tu familia estaría protegida si algo te pasara?". ',
 'Cabezas de familia 35-55'),

-- ── GASTOS FINALES ─────────────────────────────────────────────────────────
('Día de Muertos — Gastos Finales', 'gastos_finales',
 '2025-10-31', '2025-11-02', true,
 '{"final_expense"}',
 'Fecha culturalmente relevante para la comunidad hispana. Alto awareness sobre planificación funeraria.',
 4,
 'La única semana del año donde hablar de gastos finales es culturalmente natural. Contenido educativo sobre dignidad y no dejar cargas a la familia. Tono: respetuoso, cálido, no alarmista.',
 'Adultos hispanos 50+'),

('Temporada Alta Gastos Finales — Enero', 'gastos_finales',
 '2026-01-01', '2026-01-31', true,
 '{"final_expense"}',
 'Enero activa reflexión sobre planificación. Buen momento para contenido educativo sobre gastos finales.',
 3,
 'Conectar con resoluciones: "Este año quiero tener todo en orden para mi familia". Mensajes de tranquilidad y planificación, no miedo.',
 'Adultos hispanos 55+'),

-- ── FESTIVOS HISPANOS DE ALTO VALOR ────────────────────────────────────────
('Día de la Madre', 'festivo_hispano',
 '2026-05-10', '2026-05-10', true,
 '{"medicare","aca","life","final_expense"}',
 'El festivo con mayor engagement en la comunidad hispana. Ideal para contenido emocional sobre protección familiar.',
 5,
 'Semana antes: contenido sobre proteger a mamá. Contenido emocional de alta conversión. "¿Tu mamá tiene el seguro que merece?". Funciona para todos los productos. El día: post de celebración + CTA suave.',
 'Familias hispanas — todos los segmentos'),

('Día del Padre', 'festivo_hispano',
 '2026-06-21', '2026-06-21', true,
 '{"iul","life","mortgage"}',
 'Alto engagement para mensajes de legado y protección familiar liderada por el padre.',
 4,
 'Mensajes de legado y responsabilidad. IUL y seguro de vida son los productos más relevantes. "Un buen padre protege a su familia".',
 'Hombres hispanos 35-55'),

('Navidad y Año Nuevo', 'festivo_hispano',
 '2025-12-20', '2026-01-05', true,
 '{"iul","life","medicare","final_expense"}',
 'Período de máxima conexión familiar. Alto engagement pero baja conversión directa — ideal para brand awareness y calidez.',
 4,
 'No vendas directamente. Publica contenido de gratitud, familia, y reflexión sobre el año. Siembra: "En el nuevo año, protege lo que más amas". El CTA es suave y para enero.',
 'Familias hispanas — todos los segmentos'),

('Día de Acción de Gracias', 'festivo_hispano',
 '2025-11-27', '2025-11-27', true,
 '{"life","iul","final_expense"}',
 'Reflexión sobre lo que se tiene. Buen momento para contenido sobre proteger lo que importa.',
 3,
 'Contenido de gratitud + mensaje de protección. "Lo que más agradezco es poder proteger a mi familia". Funciona bien para IUL y vida.',
 'Familias hispanas — todos los segmentos'),

('Independencia México — 15 de Septiembre', 'festivo_hispano',
 '2025-09-15', '2025-09-15', true,
 '{"medicare","aca","life"}',
 'Orgullo cultural. Contenido de conexión con la comunidad mexicana.',
 3,
 'Para agentes con mercado mexicano: contenido de orgullo cultural + servicio a la comunidad. "Protegiendo familias mexicanas en USA".',
 'Comunidad mexicana en USA'),

('Independencia Cuba — 20 de Mayo', 'festivo_hispano',
 '2026-05-20', '2026-05-20', true,
 '{"medicare","aca","life"}',
 'Orgullo cultural cubano. Relevante para agentes en Florida con mercado cubano.',
 3,
 'Para agentes con mercado cubano: conexión cultural profunda. "Cuidando a la comunidad cubana en USA como nos cuidamos entre nosotros".',
 'Comunidad cubana en USA — especialmente Florida'),

-- ── INDUSTRIA ──────────────────────────────────────────────────────────────
('AHIP Certification Window', 'industria',
 '2025-06-01', '2025-09-30', true,
 '{"medicare"}',
 'Período de certificación AHIP para el AEP. Los agentes deben certificarse antes de vender Medicare en el AEP.',
 4,
 'Publicar sobre el proceso de certificación AHIP. Posicionarse como agente certificado. "Ya me certifiqué para el AEP — ¿quieres que te ayude a revisar tu plan?".',
 'Agentes de Medicare — audiencia interna'),

('Pre-AEP Preparation', 'aep',
 '2025-09-01', '2025-10-14', true,
 '{"medicare"}',
 'Las 6 semanas antes del AEP son críticas para sembrar educación y generar demanda anticipada.',
 4,
 'Fase de educación: qué es el AEP, por qué importa, cuándo inscribirse. Construir lista de prospectos para el AEP. El agente que publica en este período tiene una ventaja de 3-4 semanas sobre sus competidores.',
 'Adultos 63-65 acercándose a Medicare');

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTION: build_copilot_context
-- The single function that assembles ALL 6 context layers for the AI.
-- Called before every Growth Engine and Copilot generation.
-- Phase 13: extend this function to add performance data layers.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.build_copilot_context(
  p_user_id uuid,
  p_include_history boolean default true,
  p_days_history integer default 30
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_agent_context    text;
  v_goals            record;
  v_upcoming_events  jsonb := '[]'::jsonb;
  v_activity         jsonb := '{}'::jsonb;
  v_today            date := current_date;
  v_mes_actual       text := to_char(current_date, 'YYYY-MM');
  v_result           jsonb;
begin

  -- LAYER 1: Agent context string (from Phase 4)
  select build_agent_context(p_user_id) into v_agent_context;

  -- LAYER 3: Upcoming events (next 60 days)
  select jsonb_agg(
    jsonb_build_object(
      'nombre', nombre,
      'tipo', tipo,
      'fecha_inicio', fecha_inicio::text,
      'fecha_fin', fecha_fin::text,
      'dias_hasta_inicio',
        case
          when fecha_inicio > v_today then (fecha_inicio - v_today)::integer
          when fecha_fin >= v_today then 0  -- currently active
          else null
        end,
      'dias_restantes',
        case when fecha_fin >= v_today and fecha_inicio <= v_today
          then (fecha_fin - v_today)::integer
          else null
        end,
      'importancia', importancia,
      'consejo_marketing', consejo_marketing,
      'productos_relevantes', productos_relevantes,
      'esta_activo', (fecha_inicio <= v_today and fecha_fin >= v_today)
    ) order by fecha_inicio asc
  ) into v_upcoming_events
  from public.insurance_calendar
  where
    -- Active now OR starting in next 60 days
    (fecha_fin >= v_today and fecha_inicio <= v_today + 60)
    -- Adjust for annual recurrence: match month/day regardless of year
    and (
      recurrente_anual = false
      or (
        extract(month from fecha_inicio) >= extract(month from v_today) - 1
        and extract(month from fecha_inicio) <= extract(month from v_today) + 3
      )
    );

  -- LAYER 4: Activity history (last N days)
  if p_include_history then
    select jsonb_build_object(
      'total_generados', count(*),
      'por_modulo', jsonb_object_agg(modulo, conteo),
      'dias_activos', dias_activos,
      'ultimo_uso', max_fecha
    ) into v_activity
    from (
      select
        modulo,
        count(*) as conteo,
        count(distinct date_trunc('day', created_at)) as dias_activos,
        max(created_at::text) as max_fecha
      from public.ai_usage
      where
        user_id = p_user_id
        and created_at >= current_date - p_days_history
      group by modulo
    ) sub,
    lateral (
      select count(distinct date_trunc('day', created_at)) as dias_activos
      from public.ai_usage
      where user_id = p_user_id and created_at >= current_date - p_days_history
    ) act_days,
    lateral (
      select max(created_at)::text as max_fecha
      from public.ai_usage
      where user_id = p_user_id
    ) last_use;
  end if;

  -- LAYER 6: Current month goals
  select * into v_goals
  from public.agent_goals
  where user_id = p_user_id and mes = v_mes_actual
  limit 1;

  -- Assemble final context object
  v_result := jsonb_build_object(
    'agent_context', coalesce(v_agent_context, 'Perfil básico del agente'),
    'fecha_actual', v_today::text,
    'mes_actual', v_mes_actual,
    'dia_semana', to_char(v_today, 'Day'),
    'upcoming_events', coalesce(v_upcoming_events, '[]'::jsonb),
    'activity_summary', v_activity,
    'goals', case
      when v_goals is null then null
      else jsonb_build_object(
        'meta_leads', v_goals.meta_leads,
        'meta_clientes', v_goals.meta_clientes,
        'producto_prioritario', v_goals.producto_prioritario,
        'objetivo_principal', v_goals.objetivo_principal,
        'tiempo_disponible_min', v_goals.tiempo_disponible_min,
        'leads_obtenidos', v_goals.leads_obtenidos
      )
    end,
    -- Phase 13 extension point: add performance data here
    -- 'performance_summary': null  ← Phase 13 will populate
    -- 'engagement_patterns': null  ← Phase 13 will populate
    -- 'content_performance': null  ← Phase 13 will populate
    'engine_version', '1.0',
    'available_layers', jsonb_build_array(
      'AGENT_DATA', 'SEASONALITY',
      case when v_goals is not null then 'GOALS' else null end,
      case when p_include_history then 'HISTORY' else null end
    )
  );

  return v_result;
end;
$$;
