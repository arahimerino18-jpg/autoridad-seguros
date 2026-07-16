-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 006: Phase 8 Schema
--
-- 1. objection_responses — stores generated objection responses + learning signals
-- 2. intel_source tracking — 5-level provenance for agent intelligence fields
-- 3. Trigger for total_contenidos_publicados (fixes Phase 7 gap)
-- 4. build_agent_context() extended with cliente_ideal_json
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── TABLE: objection_responses ──────────────────────────────────────────────

create table if not exists public.objection_responses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,

  objecion_texto        text not null,
  objecion_tipo         text check (objecion_tipo in ('precio','tiempo','confianza','necesidad','autoridad','otro')),
  producto              text,
  canal                 text check (canal in ('whatsapp','en_persona','llamada','messenger','otro')),
  contexto_prospecto    text,

  respuesta_json        jsonb not null,

  -- Minimum learning signals
  angulo_copiado        text,
  accion                text check (accion in ('copiado','regenerado','descartado')),
  fue_util              text check (fue_util in ('si','no','no_usada')),
  notas_agente          text,

  -- Phase 13 extension points (null until Performance Engine)
  resultado_real        text,
  tiempo_respuesta_seg  integer,

  created_at            timestamptz not null default now()
);

alter table public.objection_responses enable row level security;

create policy "Users manage own objection responses"
  on public.objection_responses for all using (auth.uid() = user_id);

create index if not exists idx_objections_user_date
  on public.objection_responses(user_id, created_at desc);

create index if not exists idx_objections_tipo
  on public.objection_responses(user_id, objecion_tipo)
  where objecion_tipo is not null;

-- ─── EXTEND: agent_intelligence_profiles — intel_source tracking ──────────────
-- 5 levels: declarado | observado | inferido | hipotesis | confirmado

alter table public.agent_intelligence_profiles
  add column if not exists tono_source           text default 'declarado'
    check (tono_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists estilo_source          text default 'declarado'
    check (estilo_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists frases_source          text default 'declarado'
    check (frases_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists objeciones_source      text default 'declarado'
    check (objeciones_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists ctas_source            text default 'declarado'
    check (ctas_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists mercado_source         text default 'declarado'
    check (mercado_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists cliente_ideal_source   text default 'declarado'
    check (cliente_ideal_source in ('declarado','observado','inferido','hipotesis','confirmado')),
  add column if not exists inferencias_pendientes jsonb default '[]'::jsonb,
  add column if not exists perfil_ia_revisado_en  timestamptz;

-- ─── TRIGGER: total_contenidos_publicados ────────────────────────────────────

create or replace function public.handle_contenido_publicado()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.fue_publicado = true and (old.fue_publicado is null or old.fue_publicado = false) then
    update public.agent_intelligence_profiles
    set
      total_contenidos_publicados = coalesce(total_contenidos_publicados, 0) + 1,
      updated_at = now()
    where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_contenido_publicado on public.contenidos;
create trigger on_contenido_publicado
  after update of fue_publicado on public.contenidos
  for each row execute function public.handle_contenido_publicado();

-- ─── UPDATE: build_agent_context() v2 — includes cliente_ideal_json ──────────

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
  v_ci       jsonb;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  select * into v_intel from public.agent_intelligence_profiles where user_id = p_user_id;
  select * into v_brand from public.brand_kits where user_id = p_user_id;

  if v_profile is null then
    return 'Agente nuevo sin perfil configurado.';
  end if;

  -- Identity
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

  -- Value proposition
  if v_intel.propuesta_de_valor is not null then
    v_context := v_context || chr(10) || '=== PROPUESTA DE VALOR ===' || chr(10);
    v_context := v_context || v_intel.propuesta_de_valor || chr(10);
  end if;

  -- Communication style
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

  -- Personal story
  if v_intel.historia_personal is not null then
    v_context := v_context || chr(10) || '=== HISTORIA PERSONAL ===' || chr(10);
    v_context := v_context || v_intel.historia_personal || chr(10);
  end if;

  -- Objections
  if v_intel.objeciones_frecuentes is not null then
    v_context := v_context || chr(10) || '=== OBJECIONES FRECUENTES ===' || chr(10);
    v_context := v_context || v_intel.objeciones_frecuentes::text || chr(10);
  end if;

  -- CTAs
  if v_intel.ctas_efectivos is not null then
    v_context := v_context || chr(10) || '=== CTAs EFECTIVOS ===' || chr(10);
    v_context := v_context || array_to_string(v_intel.ctas_efectivos, ' | ') || chr(10);
  end if;

  -- Phase 8: Ideal client
  if v_intel.cliente_ideal_json is not null then
    v_ci := v_intel.cliente_ideal_json;
    v_context := v_context || chr(10) || '=== CLIENTE IDEAL ===' || chr(10);
    if v_ci->'demografico'->>'origen' is not null then
      v_context := v_context || 'Origen: ' || (v_ci->'demografico'->>'origen') || chr(10);
    end if;
    if v_ci->'demografico'->>'edad_rango' is not null then
      v_context := v_context || 'Edad típica: ' || (v_ci->'demografico'->>'edad_rango') || chr(10);
    end if;
    if v_ci->'psicografico'->>'miedos' is not null then
      v_context := v_context || 'Miedos del cliente: ' || (v_ci->'psicografico'->>'miedos') || chr(10);
    end if;
    if v_ci->'mensajes'->>'tono_efectivo' is not null then
      v_context := v_context || 'Tono efectivo para este cliente: ' || (v_ci->'mensajes'->>'tono_efectivo') || chr(10);
    end if;
    if v_ci->'comportamiento'->>'objeciones_principales' is not null then
      v_context := v_context || 'Objeciones típicas del cliente ideal: ' || (v_ci->'comportamiento'->>'objeciones_principales') || chr(10);
    end if;
  end if;

  -- Brand visual
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
