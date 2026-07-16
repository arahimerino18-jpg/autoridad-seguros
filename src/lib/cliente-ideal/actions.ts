'use server'

/**
 * Cliente Ideal AI — Autoridad Seguros AI™
 *
 * Generates a structured ideal client profile from 3 agent inputs
 * + the full agent intelligence context.
 *
 * DESIGN PRINCIPLE: Same evidence-typing as the Growth Engine.
 * Every section declares whether it came from agent data, inference, or hypothesis.
 * The agent can approve, edit, or reject each inference.
 *
 * PROGRESSIVE ARCHITECTURE: The JSON schema (IdealClientProfile) is designed
 * to be enriched by Phase 13 with real data (engagement, conversions, campaigns)
 * without rewriting the structure.
 */

import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClienteIdealEvidenceType = 'AGENT_DATA' | 'INFERENCE' | 'HYPOTHESIS'

export interface IdealClientProfile {
  demografico: {
    edad_rango: string
    genero: string
    origen: string
    ubicacion: string
    estado_civil: string
    nivel_educacion: string
    nivel_ingreso: string
    evidencia: ClienteIdealEvidenceType
  }
  psicografico: {
    etapa_vida: string
    prioridades: string[]
    miedos: string[]
    deseos: string[]
    nivel_conocimiento_seguros: 'bajo' | 'medio' | 'alto'
    evidencia: ClienteIdealEvidenceType
  }
  comportamiento: {
    canales_preferidos: string[]
    formatos_contenido: string[]
    momento_decision: string
    objeciones_principales: string[]
    motivadores: string[]
    evidencia: ClienteIdealEvidenceType
  }
  comercial: {
    productos_relevantes: string[]
    ticket_promedio_estimado: number | null
    ciclo_decision_dias: number | null
    mejor_cta: string
    evidencia: ClienteIdealEvidenceType
  }
  mensajes: {
    tono_efectivo: string
    angulo_confianza: string
    frases_resonantes: string[]
    frases_a_evitar: string[]
    evidencia: ClienteIdealEvidenceType
  }
  meta: {
    generado_en: string
    preguntas_agente: string[]
    contexto_usado: string[]
    hipotesis_pendientes: string[]
    version: number
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

const CLIENTE_IDEAL_SYSTEM_PROMPT = `Eres un estratega de marketing especializado en seguros para la comunidad hispana en Estados Unidos.
Tu tarea es construir el perfil del cliente ideal de este agente de seguros basándote en su contexto y sus respuestas.

PRINCIPIOS OBLIGATORIOS:
1. Distingue claramente entre tres tipos de información:
   - "AGENT_DATA": el agente lo mencionó explícitamente en sus respuestas o en su perfil
   - "INFERENCE": lo inferiste estratégicamente del contexto — razonable pero no confirmado
   - "HYPOTHESIS": lo asumes sin evidencia — necesita validación del agente

2. NUNCA inventes datos como si fueran hechos. Si no sabes la edad exacta del cliente ideal, indica el rango probable y márcalo como INFERENCE.

3. Cada sección del perfil tiene un campo "evidencia" que indica la fuente del dato.

4. En el campo "meta.hipotesis_pendientes" lista TODAS las afirmaciones que hiciste sin datos reales.

5. El perfil debe ser estratégicamente útil — no genérico. Un perfil de "adultos que necesitan seguro" no sirve. Un perfil de "familias cubanas 58-68 años en Miami-Dade que llegan a Medicare por primera vez y desconfían de las aseguradoras" sí sirve.

DEVUELVE ÚNICAMENTE JSON válido con el schema IdealClientProfile. Sin texto adicional. Sin markdown.`

// ─── Generate profile ─────────────────────────────────────────────────────────

export async function generateClienteIdealAction(inputs: {
  pregunta1: string   // Problema principal que resuelves para tus mejores clientes
  pregunta2: string   // Cómo describiste tu cliente más reciente que cerró bien
  pregunta3: string   // Qué tienen en común tus mejores clientes
}): Promise<ActionResult<{ profile: IdealClientProfile; profileText: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // Load full agent context
  const [intelRes, brandKitRes, goalsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('agent_intelligence_profiles') as any)
      .select('*')
      .eq('user_id', user.id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('brand_kits') as any)
      .select('*')
      .eq('user_id', user.id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('agent_goals') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('mes', new Date().toISOString().slice(0, 7))
      .single(),
  ])

  const intel = intelRes.data as Record<string, unknown> | null
  const brandKit = brandKitRes.data as Record<string, unknown> | null
  const goals = goalsRes.data as Record<string, unknown> | null

  // Build context summary
  const contextLines = [
    '=== PERFIL DEL AGENTE ===',
    intel?.tono_comunicacion ? `Tono: ${intel.tono_comunicacion}` : '',
    intel?.mercado_objetivo ? `Mercado actual: ${intel.mercado_objetivo}` : '',
    intel?.ciudad_estado ? `Ubicación: ${intel.ciudad_estado}` : '',
    intel?.productos_principales ? `Productos: ${(intel.productos_principales as string[]).join(', ')}` : '',
    intel?.propuesta_de_valor ? `Propuesta de valor: ${intel.propuesta_de_valor}` : '',
    intel?.objeciones_frecuentes ? `Objeciones actuales: ${JSON.stringify(intel.objeciones_frecuentes)}` : '',
    intel?.ctas_efectivos ? `CTAs efectivos: ${(intel.ctas_efectivos as string[]).join(', ')}` : '',
    brandKit?.instagram_handle ? `Instagram: ${brandKit.instagram_handle}` : '',
    goals?.objetivo_principal ? `Objetivo del mes: ${goals.objetivo_principal}` : '',
    goals?.producto_prioritario ? `Producto prioritario: ${goals.producto_prioritario}` : '',
    '',
    '=== RESPUESTAS DEL AGENTE ===',
    `1. El mayor problema que resuelvo para mis mejores clientes:`,
    inputs.pregunta1,
    '',
    `2. Cómo describo a mi cliente más reciente que cerró bien:`,
    inputs.pregunta2,
    '',
    `3. Lo que tienen en común mis mejores clientes:`,
    inputs.pregunta3,
  ].filter(Boolean).join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: CLIENTE_IDEAL_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Basándote en este contexto, construye el perfil del cliente ideal:\n\n${contextLines}\n\nContexto utilizado: agent_intelligence_profiles, brand_kits, agent_goals`,
      }],
    })

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''

    let profile: IdealClientProfile
    try {
      profile = JSON.parse(rawText) as IdealClientProfile
    } catch {
      return { success: false, error: 'Error al generar el perfil. Por favor intenta de nuevo.' }
    }

    // Add metadata
    profile.meta = {
      generado_en: new Date().toISOString(),
      preguntas_agente: [inputs.pregunta1, inputs.pregunta2, inputs.pregunta3],
      contexto_usado: ['agent_intelligence_profiles', 'brand_kits', 'agent_goals'],
      hipotesis_pendientes: profile.meta?.hipotesis_pendientes ?? [],
      version: 1,
    }

    // Build readable summary
    const profileText = buildProfileText(profile)

    return { success: true, data: { profile, profileText } }
  } catch {
    return { success: false, error: 'Error al conectar con la IA. Por favor intenta de nuevo.' }
  }
}

// ─── Save approved profile ────────────────────────────────────────────────────

export async function saveClienteIdealAction(
  profile: IdealClientProfile,
  descripcionManual?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // Extract key fields to save in indexed columns
  const descripcion = descripcionManual ?? buildShortDescription(profile)

  const nichos = profile.comercial?.productos_relevantes ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('agent_intelligence_profiles') as any)
    .update({
      cliente_ideal_descripcion: descripcion,
      cliente_ideal_json: profile,
      cliente_ideal_version: profile.meta?.version ?? 1,
      cliente_ideal_fecha: new Date().toISOString(),
      nichos_secundarios: nichos.length > 1 ? nichos.slice(1) : null,
      // Also enrich objeciones if agent didn't have them yet
      ...(profile.comportamiento?.objeciones_principales?.length
        ? {
            objeciones_frecuentes: profile.comportamiento.objeciones_principales.map((o) => ({
              objecion: o,
              respuesta: '',
              categoria: 'cliente_ideal',
            })),
          }
        : {}),
    })
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Error al guardar el perfil.' }

  revalidatePath('/brand-builder')
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProfileText(profile: IdealClientProfile): string {
  const sections: string[] = []

  if (profile.demografico) {
    sections.push(`📊 PERFIL DEMOGRÁFICO [${profile.demografico.evidencia}]
• Edad: ${profile.demografico.edad_rango}
• Origen: ${profile.demografico.origen}
• Ubicación: ${profile.demografico.ubicacion}
• Nivel de ingresos: ${profile.demografico.nivel_ingreso}`)
  }

  if (profile.psicografico) {
    sections.push(`🧠 PERFIL PSICOLÓGICO [${profile.psicografico.evidencia}]
• Etapa de vida: ${profile.psicografico.etapa_vida}
• Miedos: ${profile.psicografico.miedos.join(', ')}
• Deseos: ${profile.psicografico.deseos.join(', ')}
• Conocimiento de seguros: ${profile.psicografico.nivel_conocimiento_seguros}`)
  }

  if (profile.comportamiento) {
    sections.push(`🎯 COMPORTAMIENTO [${profile.comportamiento.evidencia}]
• Canales preferidos: ${profile.comportamiento.canales_preferidos.join(', ')}
• Objeciones principales: ${profile.comportamiento.objeciones_principales.join(', ')}
• Motivadores: ${profile.comportamiento.motivadores.join(', ')}`)
  }

  if (profile.mensajes) {
    sections.push(`💬 MENSAJES EFECTIVOS [${profile.mensajes.evidencia}]
• Tono: ${profile.mensajes.tono_efectivo}
• Ángulo de confianza: ${profile.mensajes.angulo_confianza}
• Frases que resuenan: ${profile.mensajes.frases_resonantes.join(' | ')}`)
  }

  if (profile.meta?.hipotesis_pendientes?.length) {
    sections.push(`⚠️ HIPÓTESIS A VALIDAR
${profile.meta.hipotesis_pendientes.map((h) => `• ${h}`).join('\n')}`)
  }

  return sections.join('\n\n')
}

function buildShortDescription(profile: IdealClientProfile): string {
  const d = profile.demografico
  const p = profile.psicografico
  const c = profile.comportamiento

  return [
    d?.origen && `${d.origen}`,
    d?.edad_rango && `${d.edad_rango} años`,
    d?.ubicacion && `en ${d.ubicacion}`,
    p?.etapa_vida && `| ${p.etapa_vida}`,
    c?.objeciones_principales?.[0] && `| Objeción: ${c.objeciones_principales[0]}`,
  ].filter(Boolean).join(' ')
}
