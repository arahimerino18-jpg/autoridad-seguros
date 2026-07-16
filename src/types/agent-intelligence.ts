/**
 * Agent Intelligence Profile — Type definitions and data loaders
 *
 * This is the central "brain" type of the platform.
 * Every AI generation call reads from this profile to personalize output.
 */

import type { InsuranceProduct, ContentType } from './database'

// ─── Core type ────────────────────────────────────────────────────────────────

export interface AgentIntelligenceProfile {
  id: string
  user_id: string

  // Writing style
  estilo_escritura: string | null
  tono_comunicacion: string | null
  nivel_formalidad: number | null
  usa_emojis: boolean
  longitud_preferida: string | null

  // Voice & personality
  frases_propias: string[] | null
  palabras_a_evitar: string[] | null
  historias_personales: PersonalStory[] | null
  propuesta_de_valor: string | null

  // Market & products
  productos_principales: InsuranceProduct[] | null
  mercado_objetivo: string | null
  ciudad_estado: string | null
  idiomas: string[]
  comunidades: string[] | null

  // Sales intelligence
  objeciones_frecuentes: FrequentObjection[] | null
  ctas_efectivos: string[] | null
  momentos_cierre: string[] | null

  // Content performance
  tipos_contenido_preferidos: ContentType[] | null
  horarios_optimos: OptimalSchedule | null
  hashtags_recurrentes: string[] | null
  temas_de_alto_rendimiento: string[] | null

  // Brand
  color_primario: string | null
  color_secundario: string | null
  tagline: string | null
  instagram_handle: string | null

  // Learning metadata
  total_contenidos_generados: number
  total_contenidos_publicados: number
  total_objections_handled: number
  patron_edicion_json: EditingPattern | null
  score_perfil_completitud: number
  version: number
  ultima_actualizacion_ia: string | null

  created_at: string
  updated_at: string
}

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface PersonalStory {
  titulo: string
  historia: string
  cuando_usar: string    // 'objeción de precio', 'Medicare', etc.
  producto?: InsuranceProduct
}

export interface FrequentObjection {
  objecion: string
  respuesta_exitosa: string
  categoria: string      // O1-O8
  producto?: InsuranceProduct
}

export interface OptimalSchedule {
  instagram?: string[]   // ['9:00', '19:00']
  facebook?: string[]
  tiktok?: string[]
  whatsapp?: string[]
}

export interface EditingPattern {
  agrega_emojis: boolean
  acorta_textos: boolean
  cambia_tono: boolean
  agrega_ctas: boolean
  frecuencia_edicion: number  // 0-1, percentage of content edited before publishing
}

// ─── Profile completeness UI ──────────────────────────────────────────────────

export interface ProfileSection {
  key: string
  label: string
  completed: boolean
  points: number
  href: string           // Where to go to complete this section
}

export function getProfileSections(profile: AgentIntelligenceProfile): ProfileSection[] {
  return [
    {
      key: 'voz',
      label: 'Tu voz y estilo',
      completed: !!profile.tono_comunicacion && !!profile.propuesta_de_valor,
      points: 16,
      href: '/settings/perfil-ia',
    },
    {
      key: 'mercado',
      label: 'Tu mercado objetivo',
      completed: !!profile.mercado_objetivo && !!profile.ciudad_estado,
      points: 16,
      href: '/settings/perfil-ia',
    },
    {
      key: 'productos',
      label: 'Tus productos principales',
      completed:
        !!profile.productos_principales && profile.productos_principales.length > 0,
      points: 8,
      href: '/settings/perfil-ia',
    },
    {
      key: 'objeciones',
      label: 'Tus objeciones frecuentes',
      completed:
        !!profile.objeciones_frecuentes && profile.objeciones_frecuentes.length > 0,
      points: 15,
      href: '/settings/perfil-ia',
    },
    {
      key: 'ctas',
      label: 'Tus CTAs efectivos',
      completed: !!profile.ctas_efectivos && profile.ctas_efectivos.length > 0,
      points: 15,
      href: '/settings/perfil-ia',
    },
    {
      key: 'historias',
      label: 'Tus historias personales',
      completed:
        !!profile.historias_personales && profile.historias_personales.length > 0,
      points: 10,
      href: '/settings/perfil-ia',
    },
    {
      key: 'frases',
      label: 'Tus frases características',
      completed: !!profile.frases_propias && profile.frases_propias.length > 0,
      points: 10,
      href: '/settings/perfil-ia',
    },
    {
      key: 'marca',
      label: 'Tu marca visual',
      completed: !!profile.instagram_handle && !!profile.tagline,
      points: 10,
      href: '/brand-builder',
    },
  ]
}

/**
 * Builds the AI context block injected into every prompt.
 * This is the function that makes the AI sound like the agent.
 */
export function buildAgentContext(profile: AgentIntelligenceProfile): string {
  const lines: string[] = []

  lines.push('=== PERFIL DEL AGENTE ===')

  if (profile.tono_comunicacion) {
    lines.push(`Tono de comunicación: ${profile.tono_comunicacion}`)
  }
  if (profile.estilo_escritura) {
    lines.push(`Estilo de escritura: ${profile.estilo_escritura}`)
  }
  if (profile.nivel_formalidad) {
    const formalityLabel = ['', 'muy informal', 'informal', 'neutro', 'formal', 'muy formal']
    lines.push(`Nivel de formalidad: ${formalityLabel[profile.nivel_formalidad]}`)
  }
  if (profile.usa_emojis !== undefined) {
    lines.push(`Uso de emojis: ${profile.usa_emojis ? 'sí, de forma estratégica' : 'no'}`)
  }

  if (profile.propuesta_de_valor) {
    lines.push(`\nPropuesta de valor del agente: "${profile.propuesta_de_valor}"`)
  }
  if (profile.mercado_objetivo) {
    lines.push(`Mercado objetivo: ${profile.mercado_objetivo}`)
  }
  if (profile.ciudad_estado) {
    lines.push(`Opera en: ${profile.ciudad_estado}`)
  }
  if (profile.comunidades?.length) {
    lines.push(`Comunidades que atiende: ${profile.comunidades.join(', ')}`)
  }

  if (profile.frases_propias?.length) {
    lines.push(`\nFrases características del agente (úsalas naturalmente):`)
    profile.frases_propias.forEach((f) => lines.push(`  - "${f}"`))
  }

  if (profile.palabras_a_evitar?.length) {
    lines.push(`\nPalabras/frases que NUNCA debe usar:`)
    profile.palabras_a_evitar.forEach((p) => lines.push(`  - "${p}"`))
  }

  if (profile.ctas_efectivos?.length) {
    lines.push(
      `\nCTAs que han funcionado para este agente (prioriza estos):`,
      ...profile.ctas_efectivos.map((c) => `  - "${c}"`)
    )
  }

  if (profile.tagline) {
    lines.push(`\nTagline del agente: "${profile.tagline}"`)
  }
  if (profile.instagram_handle) {
    lines.push(`Instagram: ${profile.instagram_handle}`)
  }

  lines.push('=== FIN DEL PERFIL ===')

  return lines.join('\n')
}
