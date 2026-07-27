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

  for (const [key, value] of Object.entries(data.datos_estructurados)) {
    if (brandKitFields.includes(key)) {
      brandData[key] = value
    } else {
      intelData[key] = value
    }
  }

  // Mark interview as completed
  intelData.entrevista_completada = true
  intelData.entrevista_fecha = new Date().toISOString()

  // Save to both tables
  const results = await Promise.allSettled([
    Object.keys(intelData).length > 0
      ? updateIntelProfile(supabase, user.id, intelData)
      : Promise.resolve({ error: null }),
    Object.keys(brandData).length > 0
      ? updateBrandKit(supabase, user.id, brandData)
      : Promise.resolve({ error: null }),
  ])

  const hasError = results.some(
    (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
  )

  if (hasError) return { success: false, error: 'Error al guardar el perfil de la entrevista.' }

  // Mark interview session as approved
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

export async function createInterviewSessionAction(): Promise<{
  success: boolean
  sessionId?: string
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any

  // Return existing active session if one exists
  const { data: existing } = await client
    .from('interview_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('es_activa', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return { success: true, sessionId: existing.id as string }
  }

  // Create new session
  const { data: newSess, error } = await client
    .from('interview_sessions')
    .insert({ user_id: user.id, status: 'en_progreso', es_activa: true })
    .select('id')
    .single()

  if (error) {
    console.error('[createInterviewSessionAction] failed:', error.message, 'code:', error.code)
    return { success: false, error: `Error al crear la sesión: ${error.message}` }
  }

  return { success: true, sessionId: (newSess as { id: string }).id }
}
