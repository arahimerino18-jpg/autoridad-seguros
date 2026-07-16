-- ═══════════════════════════════════════════════════════════════════════════════
-- Autoridad Seguros AI™ — Migration 011: Phase 12
--
-- 1. inference_rejection_log: add 'estado' field to InferenciaRechazada objects
--    (archived entries become eligible for cleanup per Decisión C policy)
--
-- NOTE: inference_rejection_log is a JSONB column, not a separate table.
-- The structure of each element is extended in TypeScript and the aggregator.
-- No new tables are needed.
--
-- Policy for cleanup (both conditions REQUIRED per Decisión C):
--   a) evidence_count_at_rejection < 3
--   b) antigüedad > 180 días
--   c) estado = 'archivado'
--   d) sin referencias activas (campo not in current inferencias_pendientes)
--
-- Rejections with strong evidence (count >= 3) are NEVER auto-cleaned.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Document the Phase 12 extensions to the JSONB structure.
-- These are applied at the application layer — no schema ALTER needed.

-- Extended InferenciaRechazada structure (stored in inference_rejection_log JSONB array):
-- {
--   campo: string
--   valor_hash: string
--   rechazado_en: string           (ISO timestamp)
--   evidence_count_at_rejection: number
--   razon?: string
--   -- Phase 12 additions:
--   estado: 'activo' | 'archivado'  -- default 'activo'; 'archivado' when eligible for cleanup
-- }

-- Function: cleanup_archived_rejections
-- Removes rejection log entries that meet ALL Decisión C conditions.
-- Safe to call periodically — idempotent.

create or replace function public.cleanup_archived_rejections(p_user_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_rejection_log  jsonb;
  v_pending        jsonb;
  v_cleaned        jsonb := '[]'::jsonb;
  v_removed_count  integer := 0;
  v_entry          jsonb;
  v_campo          text;
  v_count          integer;
  v_rechazado_en   timestamptz;
  v_estado         text;
  v_days_old       numeric;
  v_in_pending     boolean;
begin
  select
    coalesce(inference_rejection_log, '[]'::jsonb),
    coalesce(inferencias_pendientes, '[]'::jsonb)
  into v_rejection_log, v_pending
  from public.agent_intelligence_profiles
  where user_id = p_user_id;

  if v_rejection_log is null or jsonb_array_length(v_rejection_log) = 0 then
    return 0;
  end if;

  for v_entry in select * from jsonb_array_elements(v_rejection_log)
  loop
    v_campo         := v_entry->>'campo';
    v_count         := coalesce((v_entry->>'evidence_count_at_rejection')::integer, 0);
    v_rechazado_en  := coalesce((v_entry->>'rechazado_en')::timestamptz, now());
    v_estado        := coalesce(v_entry->>'estado', 'activo');
    v_days_old      := extract(epoch from (now() - v_rechazado_en)) / 86400;

    -- Check if campo is referenced in inferencias_pendientes (active reference)
    select exists(
      select 1 from jsonb_array_elements(v_pending) as p
      where p->>'campo' = v_campo
        and p->>'valor_hash' = v_entry->>'valor_hash'
    ) into v_in_pending;

    -- Decisión C: ALL four conditions must be true to remove
    if v_count < 3
       and v_days_old > 180
       and v_estado = 'archivado'
       and not v_in_pending
    then
      v_removed_count := v_removed_count + 1;
      -- Skip (don't add to cleaned = effectively removes it)
    else
      v_cleaned := v_cleaned || v_entry;
    end if;
  end loop;

  if v_removed_count > 0 then
    update public.agent_intelligence_profiles
    set inference_rejection_log = v_cleaned,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return v_removed_count;
end;
$$;

-- Note: this function is called from application layer (Fase 12 cleanup action).
-- A future cron job can call it for all users periodically.
-- It is NOT called automatically on rejection — only on explicit cleanup requests.
