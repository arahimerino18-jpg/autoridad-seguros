'use server'

/**
 * Autoridad Seguros AI™ — Agent Profile Update Service
 *
 * SINGLE AUTHORIZED PATH for all writes to agent_intelligence_profiles.
 *
 * Every modification through this service:
 *   1. Reads the current value (for history)
 *   2. Validates the caller's authorization
 *   3. Writes the new value
 *   4. Records in agent_intel_profile_history (non-blocking)
 *   5. Updates _source column
 *   6. Returns result
 *
 * RULE: No other code should call supabase.from('agent_intelligence_profiles').update()
 *       directly for content fields. Use this service instead.
 *
 * EXCEPTIONS (allowed to bypass this service):
 *   - Aggregator engine: writes inferencias_pendientes array (not a profile field)
 *   - Cleanup cron: writes inference_rejection_log (not a profile field)
 *   - Reversion: handled internally by revertIntelFieldAction() which calls this service
 */

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntelSource, IntelProfileChangeSource } from '@/types/database'

type AnyClient = SupabaseClient

// ─── Update params ────────────────────────────────────────────────────────────

export interface UpdateAgentProfileParams {
  // The field(s) to update — all go through history recording
  campos: Record<string, unknown>

  // Provenance
  sourceType: IntelProfileChangeSource
  origen: string                // 'brand_builder' | 'onboarding' | 'interview' | 'settings'

  // Optional context
  motivo?: string               // Human-readable reason
  fuenteEvidencia?: string      // For AI-sourced changes
  evidenceCount?: number        // Number of signals (for AI inferences)

  // Source level for _source columns (defaults to sourceType mapping)
  intelSource?: IntelSource     // Override the _source value written alongside the field
}

export interface SupabaseErrorDetail {
  code?: string
  message: string
  details?: string
  hint?: string
  status?: number
  statusCode?: number
}

export interface UpdateAgentProfileResult {
  success: boolean
  error?: string
  supabaseError?: SupabaseErrorDetail  // full Supabase error for diagnostic propagation
  historyIds: (string | null)[]
}

// ─── Mapping: changeSource → IntelSource ─────────────────────────────────────

const CHANGE_TO_INTEL_SOURCE: Record<IntelProfileChangeSource, IntelSource> = {
  declarado:           'declarado',
  inferencia_ia:       'confirmado',
  inferencia_editada:  'confirmado',
  reversion:           'declarado',   // Reversion is agent-controlled = declarado
  importado:           'observado',
}

// ─── Campo → real _source column name ─────────────────────────────────────────
// Maps a profile field to the actual _source column that exists in the DB.
// Source column names do NOT follow a generic ${campo}_source pattern —
// they have their own names (e.g. tono_comunicacion → tono_source).
// Only columns confirmed in migrations/006 and migrations/012 are listed here.
// PGRST204 "column not found" will occur if you add an entry whose _source
// column does not exist in agent_intelligence_profiles.

const CAMPO_TO_SOURCE_COLUMN: Record<string, string> = {
  tono_comunicacion:    'tono_source',
  estilo_escritura:     'estilo_source',
  frases_propias:       'frases_source',
  objeciones_frecuentes:'objeciones_source',
  ctas_efectivos:       'ctas_source',
  mercado_objetivo:     'mercado_source',
  cliente_ideal_json:   'cliente_ideal_source',
  canal_preferido:      'canal_preferido_source',
  // NOTE: historia_personal, productos_principales, propuesta_de_valor, etc.
  // do NOT have _source columns in the DB — do not add them here.
}

// ─── Main service function ────────────────────────────────────────────────────

export async function updateAgentProfile(
  params: UpdateAgentProfileParams
): Promise<UpdateAgentProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado', historyIds: [] }

  const client = supabase as unknown as AnyClient
  const intelSource = params.intelSource ?? CHANGE_TO_INTEL_SOURCE[params.sourceType]

  // 1. Read current values for history recording
  // Only select fields that exist as columns — unknown fields cause 400 errors
  const KNOWN_COLUMNS = new Set([
    'id','user_id','estilo_escritura','tono_comunicacion','nivel_formalidad','usa_emojis',
    'longitud_preferida','frases_propias','palabras_a_evitar','historias_personales',
    'propuesta_de_valor','productos_principales','mercado_objetivo','ciudad_estado',
    'idiomas','comunidades','objeciones_frecuentes','ctas_efectivos','momentos_cierre',
    'tipos_contenido_preferidos','horarios_optimos','hashtags_recurrentes',
    'temas_de_alto_rendimiento','color_primario','color_secundario','tagline',
    'instagram_handle','historia_profesional','historia_personal','mision','vision',
    'valores','diferenciadores','tipo_humor','nivel_emocional','usa_historias',
    'usa_estadisticas','cliente_ideal_descripcion','cliente_ideal_json',
    'cliente_ideal_version','cliente_ideal_fecha','nichos_secundarios',
    'problemas_que_resuelve','metas_negocio','fuente_leads_principal',
    'tasa_cierre_estimada','ticket_promedio_usd','entrevista_completada','entrevista_fecha',
    'inferencias_pendientes','perfil_ia_revisado_en','canal_preferido',
    'score_perfil_completitud','version','ultima_actualizacion_ia','created_at','updated_at',
    'tono_source','estilo_source','frases_source','objeciones_source','ctas_source',
    'mercado_source','cliente_ideal_source','canal_preferido_source',
    'inference_rejection_log','total_contenidos_generados','total_contenidos_publicados',
    'total_objections_handled','patron_edicion_json',
  ])

  const allFieldNames = Object.keys(params.campos)
  const fieldNames = allFieldNames.filter(f => KNOWN_COLUMNS.has(f))
  const skipped = allFieldNames.filter(f => !KNOWN_COLUMNS.has(f))
  if (skipped.length > 0) {
    console.warn('[updateAgentProfile] skipping unknown columns:', skipped)
  }

  if (fieldNames.length === 0) {
    return { success: true, historyIds: [] }  // nothing valid to update
  }

  const { data: currentData } = await client
    .from('agent_intelligence_profiles')
    .select(fieldNames.join(', '))
    .eq('user_id', user.id)
    .single()

  const currentValues = (currentData as Record<string, unknown> | null) ?? {}

  // 2. Build the update payload
  const updatePayload: Record<string, unknown> = {
    ...params.campos,
    updated_at: new Date().toISOString(),
  }

  // Auto-update _source columns for tracked fields.
  // Uses CAMPO_TO_SOURCE_COLUMN to map to the real column name — never uses
  // the generic ${campo}_source pattern which generates non-existent columns.
  for (const campo of fieldNames) {
    const sourceCol = CAMPO_TO_SOURCE_COLUMN[campo]
    if (sourceCol) {
      updatePayload[sourceCol] = intelSource
    }
  }

  // 3. Write to database — only include known columns in payload
  const safePayload: Record<string, unknown> = { updated_at: updatePayload.updated_at }
  for (const [k, v] of Object.entries(updatePayload)) {
    // Only include columns confirmed in KNOWN_COLUMNS.
    // _source columns are added by CAMPO_TO_SOURCE_COLUMN with their real names,
    // which are already listed in KNOWN_COLUMNS — no generic endsWith check needed.
    if (KNOWN_COLUMNS.has(k)) safePayload[k] = v
  }

  const { error } = await client
    .from('agent_intelligence_profiles')
    .update(safePayload)
    .eq('user_id', user.id)

  if (error) {
    const supabaseError: SupabaseErrorDetail = {
      code:       (error as {code?: string}).code,
      message:    error.message,
      details:    (error as {details?: string}).details,
      hint:       (error as {hint?: string}).hint,
      status:     (error as {status?: number}).status,
      statusCode: (error as {statusCode?: number}).statusCode,
    }
    console.error('[updateAgentProfile] Supabase error', {
      ...supabaseError,
      operation: 'UPDATE agent_intelligence_profiles',
      attemptedFields: Object.keys(safePayload).filter(k => k !== 'updated_at'),
    })
    return { success: false, error: error.message, supabaseError, historyIds: [] }
  }

  // 4. Record history for each field (non-blocking — failures don't break the write)
  const historyIds: (string | null)[] = []

  for (const campo of fieldNames) {
    const valorAnterior = currentValues[campo] ?? null
    const valorNuevo = params.campos[campo]

    // Skip if value didn't actually change
    if (JSON.stringify(valorAnterior) === JSON.stringify(valorNuevo)) {
      historyIds.push(null)
      continue
    }

    try {
      // Dynamic import avoids circular dependency issues
      const { recordIntelProfileChange } = await import('./history')
      const histId = await recordIntelProfileChange({
        userId: user.id,
        campo,
        valorAnterior,
        valorNuevo,
        sourceType: params.sourceType,
        origen: params.origen,
        motivo: params.motivo,
        fuenteEvidencia: params.fuenteEvidencia,
        evidenceCount: params.evidenceCount,
      })
      historyIds.push(histId)
    } catch (histErr) {
      console.warn('[updateAgentProfile] History recording failed for', campo, histErr)
      historyIds.push(null)
    }
  }

  return { success: true, historyIds }
}

// ─── Typed convenience wrappers ───────────────────────────────────────────────
// These make call sites cleaner and encode the correct sourceType.

/**
 * Update from agent's direct input (Brand Builder, onboarding, settings).
 */
export async function updateAgentProfileDeclared(
  campos: Record<string, unknown>,
  origen: string,
  motivo?: string
): Promise<UpdateAgentProfileResult> {
  return updateAgentProfile({ campos, sourceType: 'declarado', origen, motivo })
}

/**
 * Apply an approved AI inference (with or without agent edit).
 */
export async function updateAgentProfileFromInference(
  campos: Record<string, unknown>,
  edited: boolean,
  fuenteEvidencia: string,
  evidenceCount: number,
  motivo?: string
): Promise<UpdateAgentProfileResult> {
  return updateAgentProfile({
    campos,
    sourceType: edited ? 'inferencia_editada' : 'inferencia_ia',
    origen: 'brand_builder',
    motivo: motivo ?? (edited ? 'Inferencia de IA aprobada con edición' : 'Inferencia de IA aprobada'),
    fuenteEvidencia,
    evidenceCount,
  })
}
