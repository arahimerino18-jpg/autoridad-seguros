'use server'

/**
 * Brand Builder Server Actions — Autoridad Seguros AI™
 *
 * Each section of the Brand Builder saves independently.
 * This enables progressive completion: the agent can save what they have
 * and return later without losing partial progress.
 *
 * Architecture: Every save writes to TWO tables simultaneously:
 *   1. brand_kits — visual identity, social, professional identity
 *   2. agent_intelligence_profiles — voice, market, values, stories
 *
 * This keeps the "write interface" (Brand Builder) and
 * "read interface" (AI context) synchronized automatically.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'
import { updateAgentProfileDeclared } from '@/lib/intelligence/profile-service'

// ─── Helper: get authenticated user ──────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, supabase }
  return { user, supabase }
}

// ─── Helper: update profile table ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateIntelProfile(_supabase: unknown, _userId: string, data: Record<string, unknown>, origen = 'brand_builder') {
  // Delegates to the centralized profile service (Phase 14)
  const result = await updateAgentProfileDeclared(data, origen)
  return { error: result.error ? new Error(result.error) : null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateBrandKit(supabase: any, userId: string, data: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('brand_kits') as any)
    .update(data)
    .eq('user_id', userId)
  return { error }
}

// ─── TAB 1: Identidad Profesional ────────────────────────────────────────────

export interface IdentidadProfesionalData {
  nombre_completo?: string
  nombre_comercial?: string
  nombre_agencia?: string
  anos_experiencia?: number
  estados_licencia?: string[]
  numero_licencia?: string
  certificaciones?: string[]
  idiomas?: string[]
  historia_profesional?: string
  historia_personal?: string
  mision?: string
  vision?: string
  valores?: string[]
}

export async function saveIdentidadProfesionalAction(
  data: IdentidadProfesionalData
): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // Update brand_kits with professional identity fields
  const brandKitData: Record<string, unknown> = {}
  if (data.nombre_comercial !== undefined) brandKitData.nombre_comercial = data.nombre_comercial
  if (data.nombre_agencia !== undefined) brandKitData.nombre_agencia = data.nombre_agencia
  if (data.anos_experiencia !== undefined) brandKitData.anos_experiencia = data.anos_experiencia
  if (data.estados_licencia !== undefined) brandKitData.estados_licencia = data.estados_licencia
  if (data.numero_licencia !== undefined) brandKitData.numero_licencia = data.numero_licencia
  if (data.certificaciones !== undefined) brandKitData.certificaciones = data.certificaciones

  if (Object.keys(brandKitData).length > 0) {
    const { error } = await updateBrandKit(supabase, user.id, brandKitData)
    if (error) return { success: false, error: 'Error al guardar identidad profesional.' }
  }

  // Update agent_intelligence_profiles with deep identity
  const intelData: Record<string, unknown> = {}
  if (data.idiomas !== undefined) intelData.idiomas = data.idiomas
  if (data.historia_profesional !== undefined) intelData.historia_profesional = data.historia_profesional
  if (data.historia_personal !== undefined) intelData.historia_personal = data.historia_personal
  if (data.mision !== undefined) intelData.mision = data.mision
  if (data.vision !== undefined) intelData.vision = data.vision
  if (data.valores !== undefined) intelData.valores = data.valores

  if (Object.keys(intelData).length > 0) {
    const { error } = await updateIntelProfile(supabase, user.id, intelData)
    if (error) return { success: false, error: 'Error al guardar historia profesional.' }
  }

  // Update nombre_completo in profiles if provided
  if (data.nombre_completo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ nombre_completo: data.nombre_completo })
      .eq('id', user.id)
  }

  revalidatePath('/brand-builder')
  return { success: true, data: undefined }
}

// ─── TAB 2: Marca Personal ────────────────────────────────────────────────────

export interface MarcaPersonalData {
  tono_comunicacion?: string
  nivel_formalidad?: number
  estilo_escritura?: string
  tipo_humor?: string
  nivel_emocional?: string
  usa_emojis?: boolean
  usa_historias?: boolean
  usa_estadisticas?: boolean
  frases_propias?: string[]
  palabras_a_evitar?: string[]
  ctas_efectivos?: string[]
  propuesta_de_valor?: string
  diferenciadores?: string[]
  longitud_preferida?: string
}

export async function saveMarcaPersonalAction(data: MarcaPersonalData): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  const intelData: Record<string, unknown> = {}
  const fields: (keyof MarcaPersonalData)[] = [
    'tono_comunicacion', 'nivel_formalidad', 'estilo_escritura',
    'tipo_humor', 'nivel_emocional', 'usa_emojis', 'usa_historias',
    'usa_estadisticas', 'frases_propias', 'palabras_a_evitar',
    'ctas_efectivos', 'propuesta_de_valor', 'diferenciadores', 'longitud_preferida'
  ]

  for (const field of fields) {
    if (data[field] !== undefined) intelData[field] = data[field]
  }

  const { error } = await updateIntelProfile(supabase, user.id, intelData)
  if (error) return { success: false, error: 'Error al guardar marca personal.' }

  // Sync tagline to brand_kits if propuesta_de_valor was updated
  if (data.propuesta_de_valor) {
    await updateBrandKit(supabase, user.id, {
      tono_de_voz: data.tono_comunicacion ?? null,
    })
  }

  revalidatePath('/brand-builder')
  return { success: true, data: undefined }
}

// ─── TAB 3: Público Objetivo ──────────────────────────────────────────────────

export interface PublicoObjetivoData {
  mercado_objetivo?: string
  cliente_ideal_descripcion?: string
  nichos_secundarios?: string[]
  productos_principales?: string[]
  problemas_que_resuelve?: string[]
  objeciones_frecuentes?: Array<{ objecion: string; respuesta: string; categoria: string }>
  metas_negocio?: { corto_plazo: string; largo_plazo: string }
  fuente_leads_principal?: string
  tasa_cierre_estimada?: number
  ticket_promedio_usd?: number
}

export async function savePublicoObjetivoAction(data: PublicoObjetivoData): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  const intelData: Record<string, unknown> = {}
  const fields: (keyof PublicoObjetivoData)[] = [
    'mercado_objetivo', 'cliente_ideal_descripcion', 'nichos_secundarios',
    'productos_principales', 'problemas_que_resuelve', 'objeciones_frecuentes',
    'metas_negocio', 'fuente_leads_principal', 'tasa_cierre_estimada', 'ticket_promedio_usd'
  ]

  for (const field of fields) {
    if (data[field] !== undefined) intelData[field] = data[field]
  }

  const { error } = await updateIntelProfile(supabase, user.id, intelData)
  if (error) return { success: false, error: 'Error al guardar público objetivo.' }

  revalidatePath('/brand-builder')
  return { success: true, data: undefined }
}

// ─── TAB 4: Identidad Visual ──────────────────────────────────────────────────

export interface IdentidadVisualData {
  color_primario?: string
  color_secundario?: string
  color_acento?: string
  tipografia_principal?: string
  tipografia_secundaria?: string
  estilo_grafico?: string
  estilo_fotografico?: string
  tagline?: string
  logo_url?: string
  logo_variante_blanca_url?: string
  logo_variante_oscura_url?: string
  logo_icono_url?: string
}

export async function saveIdentidadVisualAction(data: IdentidadVisualData): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  const brandData: Record<string, unknown> = {}
  const fields: (keyof IdentidadVisualData)[] = [
    'color_primario', 'color_secundario', 'color_acento',
    'tipografia_principal', 'tipografia_secundaria',
    'estilo_grafico', 'estilo_fotografico', 'tagline',
    'logo_url', 'logo_variante_blanca_url', 'logo_variante_oscura_url', 'logo_icono_url'
  ]

  for (const field of fields) {
    if (data[field] !== undefined) brandData[field] = data[field]
  }

  const { error } = await updateBrandKit(supabase, user.id, brandData)
  if (error) return { success: false, error: 'Error al guardar identidad visual.' }

  // Sync brand colors to intelligence profile
  const intelSync: Record<string, unknown> = {}
  if (data.color_primario) intelSync.color_primario = data.color_primario
  if (data.color_secundario) intelSync.color_secundario = data.color_secundario
  if (data.tagline) intelSync.tagline = data.tagline
  if (Object.keys(intelSync).length > 0) {
    await updateIntelProfile(supabase, user.id, intelSync)
  }

  revalidatePath('/brand-builder')
  return { success: true, data: undefined }
}

// ─── TAB 5: Redes Sociales ────────────────────────────────────────────────────

export interface RedesSocialesData {
  instagram_handle?: string
  facebook_url?: string
  tiktok_handle?: string
  linkedin_url?: string
  youtube_url?: string
  pinterest_url?: string
  whatsapp_business?: string
  calendly_url?: string
  sitio_web?: string
}

export async function saveRedesSocialesAction(data: RedesSocialesData): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  const brandData: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      // Normalize Instagram handle
      if (key === 'instagram_handle' && val && !String(val).startsWith('@')) {
        brandData[key] = `@${val}`
      } else {
        brandData[key] = val
      }
    }
  }

  const { error } = await updateBrandKit(supabase, user.id, brandData)
  if (error) return { success: false, error: 'Error al guardar redes sociales.' }

  // Sync Instagram handle to intelligence profile
  if (data.instagram_handle) {
    const handle = data.instagram_handle.startsWith('@')
      ? data.instagram_handle
      : `@${data.instagram_handle}`
    await updateIntelProfile(supabase, user.id, { instagram_handle: handle })
  }

  revalidatePath('/brand-builder')
  return { success: true, data: undefined }
}

// ─── SAVE FROM INTERVIEW ──────────────────────────────────────────────────────

export interface InterviewSaveData {
  datos_estructurados: Record<string, unknown>
  resumen_visible: string
  session_id: string
}

// Alias mapping: short names used by Claude in METADATA → real column names in agent_intelligence_profiles
const INTERVIEW_KEY_ALIASES: Record<string, string> = {
  objeciones:          'objeciones_frecuentes',
  frases:              'frases_propias',
  ctas:                'ctas_efectivos',
  mision_profesional:  'mision',
  vision_negocio:      'vision',
  cliente_ideal:       'cliente_ideal_descripcion',
  estilo_comunicacion: 'tono_comunicacion',
  motivacion_profunda: 'historia_profesional',
  historia:            'historia_personal',
}

// Exact set of valid columns in agent_intelligence_profiles
// Any key not in this set is silently skipped to prevent 400 errors
const VALID_INTEL_COLUMNS = new Set([
  'estilo_escritura','tono_comunicacion','nivel_formalidad','usa_emojis',
  'longitud_preferida','frases_propias','palabras_a_evitar','historias_personales',
  'propuesta_de_valor','productos_principales','mercado_objetivo','ciudad_estado',
  'idiomas','comunidades','objeciones_frecuentes','ctas_efectivos','momentos_cierre',
  'tipos_contenido_preferidos','horarios_optimos','hashtags_recurrentes',
  'temas_de_alto_rendimiento','color_primario','color_secundario','tagline',
  'instagram_handle','historia_profesional','historia_personal','mision','vision',
  'valores','diferenciadores','tipo_humor','nivel_emocional','usa_historias',
  'usa_estadisticas','cliente_ideal_descripcion','nichos_secundarios',
  'problemas_que_resuelve','metas_negocio','fuente_leads_principal',
  'tasa_cierre_estimada','ticket_promedio_usd','entrevista_completada','entrevista_fecha',
  'canal_preferido',
])

export async function saveInterviewResultAction(data: InterviewSaveData): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // Separate brand_kits fields from intelligence_profile fields
  const brandKitFields = [
    'nombre_comercial', 'nombre_agencia', 'anos_experiencia',
    'estados_licencia', 'color_primario', 'color_secundario',
    'tagline', 'instagram_handle', 'estilo_grafico', 'estilo_fotografico',
  ]

  const brandData: Record<string, unknown> = {}
  const intelData: Record<string, unknown> = {}

  for (const [rawKey, value] of Object.entries(data.datos_estructurados)) {
    // Resolve alias (e.g. 'objeciones' → 'objeciones_frecuentes')
    const key = INTERVIEW_KEY_ALIASES[rawKey] ?? rawKey

    if (brandKitFields.includes(key)) {
      brandData[key] = value
    } else if (VALID_INTEL_COLUMNS.has(key)) {
      intelData[key] = value
    } else {
      console.log('[saveInterviewResultAction] skipping unknown key:', rawKey, '→', key)
    }
  }

  console.log('[saveInterviewResultAction] intelData keys:', Object.keys(intelData))
  console.log('[saveInterviewResultAction] brandData keys:', Object.keys(brandData))

  // Mark interview as completed
  intelData.entrevista_completada = true
  intelData.entrevista_fecha = new Date().toISOString()

  // Save intel profile first — only proceed if it succeeds
  if (Object.keys(intelData).length > 0) {
    const intelResult = await updateIntelProfile(supabase, user.id, intelData)
    if (intelResult.error) {
      // Error is already logged by updateAgentProfile with full Supabase details
      console.error('[saveInterviewResultAction] intel profile update failed:', intelResult.error)
      return { success: false, error: 'Error al guardar el perfil de la entrevista.' }
    }
  }

  // Save brand kit (non-critical — don't block on failure)
  if (Object.keys(brandData).length > 0) {
    const brandResult = await updateBrandKit(supabase, user.id, brandData)
    if (brandResult.error) {
      console.warn('[saveInterviewResultAction] brand kit update failed (non-critical):', brandResult.error)
    }
  }

  // Mark interview session as approved — only after intel profile saved successfully
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('interview_sessions') as any)
    .update({ status: 'aprobado', es_activa: false })
    .eq('id', data.session_id)
    .eq('user_id', user.id)

  revalidatePath('/brand-builder')
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

// ─── Create Interview Session ─────────────────────────────────────────────────
// Called client-side when the user clicks "Comenzar entrevista ahora".
// Server Actions have correctly hydrated cookies in Vercel — auth.uid() works.
// This avoids the RSC cookie propagation issue that caused sessionId = ''.

export interface InterviewSessionData {
  sessionId: string
  conversacion: Array<{ role: string; content: string; timestamp: string }>
  temas_cubiertos: string[]
  status: string
}

export async function createInterviewSessionAction(): Promise<{
  success: boolean
  session?: InterviewSessionData
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any

  // Return existing active session WITH full data so the client can restore it
  const { data: existing } = await client
    .from('interview_sessions')
    .select('id, conversacion, temas_cubiertos, status')
    .eq('user_id', user.id)
    .eq('es_activa', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    console.log('[createInterviewSessionAction] found existing session:', existing.id,
      'msgs:', (existing.conversacion as unknown[])?.length ?? 0,
      'temas:', (existing.temas_cubiertos as string[])?.length ?? 0,
      'status:', existing.status)
    return {
      success: true,
      session: {
        sessionId: existing.id as string,
        conversacion: (existing.conversacion as Array<{ role: string; content: string; timestamp: string }>) ?? [],
        temas_cubiertos: (existing.temas_cubiertos as string[]) ?? [],
        status: existing.status as string,
      },
    }
  }

  // Create new session
  const { data: newSess, error } = await client
    .from('interview_sessions')
    .insert({ user_id: user.id, status: 'en_progreso', es_activa: true })
    .select('id, conversacion, temas_cubiertos, status')
    .single()

  if (error) {
    console.error('[createInterviewSessionAction] failed:', error.message, 'code:', error.code)
    return { success: false, error: `Error al crear la sesión: ${error.message}` }
  }

  console.log('[createInterviewSessionAction] created new session:', (newSess as {id:string}).id)
  return {
    success: true,
    session: {
      sessionId: (newSess as { id: string }).id,
      conversacion: [],
      temas_cubiertos: [],
      status: 'en_progreso',
    },
  }
}

// Saves datos_estructurados and marks session as resumen_generado
// Called during retroactive recovery when last message contains JSON
export async function markSessionCompleteAction(
  sessionId: string,
  datosEstructurados: Record<string, unknown>,
  resumenVisible: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('interview_sessions')
    .update({
      status: 'resumen_generado',
      datos_estructurados: datosEstructurados,
      resumen_visible: resumenVisible,
      temas_cubiertos: [
        'historia_personal','motivacion_profunda','mercado_objetivo',
        'productos_principales','diferenciadores','estilo_comunicacion',
        'valores','cliente_ideal','objeciones_frecuentes',
        'frases_propias','ctas_efectivos','mision_profesional','vision_negocio',
      ],
      score_covertura: 100,
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[markSessionCompleteAction] failed:', error.message)
    return { success: false, error: error.message }
  }

  console.log('[markSessionCompleteAction] session marked complete:', sessionId)
  return { success: true }
}
