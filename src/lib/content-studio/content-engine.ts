/**
 * Content Generation Engine — Autoridad Seguros AI™
 *
 * THE ONLY PLACE where content generation logic lives.
 * Called by the API route. Never called directly from components.
 *
 * Two modes:
 *   'generate' — full pipeline: context + channel adapter → Claude
 *   'modify'   — short pipeline: existing content + instruction → Claude
 *
 * Adding a new channel: register it in channel-registry.ts. Done.
 * This file never changes for new channels.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getChannel, type ChannelId, type ContentOutput } from './channel-registry'
import { buildCopilotContext } from '@/lib/growth-engine/context-builder'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Types ────────────────────────────────────────────────────────────────────

export type GenerationMode = 'generate' | 'modify'

export type ModificationType =
  | 'mas_humano'
  | 'mas_profesional'
  | 'mas_emocional'
  | 'mas_corto'
  | 'mas_directo'
  | 'regenerar'
  | 'custom'

export interface GenerateParams {
  mode: 'generate'
  userId: string
  channelId: ChannelId
  // Intent
  tema: string                    // Free text or from Copilot recommendation
  producto: string                // insurance_product
  objetivo: 'educar' | 'conectar' | 'convertir' | 'retener'
  tono_override?: string          // Optional — defaults to agent profile tone
  instruccion_extra?: string      // Max 200 chars
  // Context linking
  growth_output_id?: string       // If generated from a Copilot recommendation
  contenido_origen_id?: string    // If adapting an existing piece
}

export interface ModifyParams {
  mode: 'modify'
  userId: string
  channelId: ChannelId
  current_output: ContentOutput   // The content to modify
  modification: ModificationType
  custom_instruction?: string     // Only if modification === 'custom'
}

export type EngineParams = GenerateParams | ModifyParams

// ─── System prompt (constant — cached by Anthropic) ──────────────────────────

const CONTENT_STUDIO_SYSTEM_PROMPT = `Eres el especialista en creación de contenido de Autoridad Seguros AI™.
Creas contenido de marketing para agentes de seguros hispanos en Estados Unidos.

PRINCIPIOS ABSOLUTOS:
1. El contenido debe sonar EXACTAMENTE como este agente — no como una IA genérica.
   Usa sus frases características. Evita sus palabras prohibidas. Replica su tono.
2. Toda pieza tiene un objetivo estratégico — no generas contenido vacío.
3. El compliance de seguros no es opcional — nunca prometas resultados o garantices planes.
4. Una pieza memorable: hook que para el scroll → cuerpo que educa o conecta → CTA que activa.
5. SIEMPRE devuelves JSON válido con el schema exacto especificado. Sin texto fuera del JSON.

COMPLIANCE BASE (aplica a todos los productos):
• Nunca afirmar que un plan es "el mejor", "el más barato", o "garantizado"
• Nunca prometer resultados de salud específicos
• No usar lenguaje de urgencia falsa ("¡Solo hoy!" sin evento real)
• Los precios siempre con calificación: "desde $0" no "$0"
• Los beneficios con contexto: "planes que pueden incluir" no "tu plan incluye"

Si no conoces datos específicos del agente, usa el contexto disponible y etiqueta con [HIPÓTESIS].`

// ─── Compliance rules by product ─────────────────────────────────────────────

const COMPLIANCE_BY_PRODUCT: Record<string, string> = {
  medicare: `COMPLIANCE MEDICARE:
• Incluir referencia a Medicare.gov o 1-800-MEDICARE si es sobre inscripción
• No afirmar que un plan específico cubre algo sin calificación ("puede cubrir", "planes que incluyen")
• Para el AEP/OEP: mencionar fechas exactas es correcto
• No comparar planes específicos de compañías sin el proceso oficial de CMS
• Si mencionas beneficios: "beneficios adicionales que pueden variar por plan y zona"`,

  aca: `COMPLIANCE ACA:
• Los subsidios dependen de ingresos — nunca afirmar montos sin calificación
• "Planes desde $0" es válido con la calificación "dependiendo de tus ingresos"
• Healthcare.gov es la referencia oficial para inscripción
• Los planes varían por estado — siempre mencionarlo
• Las fechas del OEP son precisas — correcto mencionarlas`,

  iul: `COMPLIANCE IUL / VIDA INDEXADA:
• Los IUL NO son inversiones garantizadas — son productos de seguro con componente de ahorro
• Nunca mostrar proyecciones de rendimiento como garantía: "potencial de crecimiento" ✓
• "Puedes acumular valor en efectivo" ✓ | "Ganarás X% garantizado" ✗
• El seguro de vida paga el beneficio por fallecimiento — no es un plan de retiro solo
• Para IUL: incluir "Los resultados reales dependen del desempeño del índice y los costos del seguro"`,

  final_expense: `COMPLIANCE GASTOS FINALES:
• El seguro de gastos finales cubre costos funerarios — no el total de deudas
• Los montos de cobertura son fijos — correcto mencionarlos con el contexto
• "Proteger a tu familia de gastos inesperados" ✓ | "Eliminar todas las deudas" ✗
• Para mayores con condiciones preexistentes: mencionar que hay opciones disponibles, no que todos califican`,

  life: `COMPLIANCE SEGURO DE VIDA:
• El beneficio por fallecimiento — no por enfermedad o retiro (a menos que sea específico)
• No afirmar montos de cobertura sin el proceso de aplicación
• Para seguro de término: "protección temporal" — nunca "seguro para siempre"`,

  mortgage: `COMPLIANCE PROTECCIÓN HIPOTECARIA:
• No es lo mismo que el seguro de título — aclararlo si hay confusión
• Cubre el pago de la hipoteca en caso de muerte o discapacidad del asegurado
• Los términos y condiciones varían — siempre mencionarlo`,

  general: `COMPLIANCE GENERAL:
• Aplican las reglas base del sistema para todos los productos.`,
}

// ─── Modification instructions ────────────────────────────────────────────────

const MODIFICATION_INSTRUCTIONS: Record<ModificationType, string> = {
  mas_humano: 'Hazlo más humano y conversacional. Usa primera persona más frecuente. Agrega una micro-historia o experiencia personal si aplica. Reduce el lenguaje técnico.',
  mas_profesional: 'Hazlo más profesional. Reduce emojis. Usa lenguaje más formal. Mantén credibilidad de experto. Borra expresiones demasiado coloquiales.',
  mas_emocional: 'Aumenta la carga emocional. Conecta con el miedo, la esperanza, o el amor familiar. Usa una historia o escenario que toque el corazón. Sin perder el CTA.',
  mas_corto: 'Reduce el texto al mínimo necesario. Elimina redundancias. Conserva el hook, el punto más fuerte, y el CTA. Máximo 60% del texto original.',
  mas_directo: 'Ve al punto sin rodeos. Elimina introducciones. El primer elemento ya es el beneficio o la acción. CTA más urgente.',
  regenerar: 'Regenera el contenido completamente con una perspectiva diferente. Misma intención, otro ángulo creativo.',
  custom: '', // Filled dynamically
}

// ─── Main engine function ─────────────────────────────────────────────────────

export async function* runContentEngine(
  params: EngineParams
): AsyncGenerator<string, void, unknown> {
  const channel = getChannel(params.channelId)

  if (params.mode === 'modify') {
    yield* runModifyPipeline(params, channel)
  } else {
    yield* runGeneratePipeline(params, channel)
  }
}

// ─── Generate pipeline (full context) ────────────────────────────────────────

async function* runGeneratePipeline(
  params: GenerateParams,
  channel: ReturnType<typeof getChannel>
): AsyncGenerator<string, void, unknown> {
  // Build context — depth depends on channel spec
  const contextDepth = channel.specs.context_depth
  const { formatted: agentContext } = await buildCopilotContext(params.userId, {
    includeHistory: contextDepth !== 'minimal',
    daysHistory: contextDepth === 'full' ? 30 : 7,
  })

  // Compliance for this product
  const complianceRules =
    COMPLIANCE_BY_PRODUCT[params.producto] ?? COMPLIANCE_BY_PRODUCT.general

  // Channel-specific compliance additions
  const channelCompliance = channel.compliance_additions.length > 0
    ? '\n\nCOMPLIANCE ADICIONAL PARA ESTE CANAL:\n' + channel.compliance_additions.join('\n')
    : ''

  // Output schema instruction
  const outputInstruction = `\nRETORNA ÚNICAMENTE JSON válido con este schema: ${channel.output_type}
SIN texto antes ni después del JSON. SIN markdown code blocks. Solo el JSON.`

  // Build the user message
  const userMessage = [
    '═══ CONTEXTO DEL AGENTE ═══',
    agentContext,
    '',
    '═══ INTENCIÓN DEL CONTENIDO ═══',
    `Tema/Estrategia: ${params.tema}`,
    `Producto de seguros: ${params.producto}`,
    `Objetivo del contenido: ${params.objetivo}`,
    params.tono_override ? `Tono override: ${params.tono_override}` : '',
    params.instruccion_extra ? `Instrucción especial del agente: ${params.instruccion_extra}` : '',
    '',
    '═══ CANAL: ' + channel.label.toUpperCase() + ' ═══',
    channel.format_instruction,
    '',
    '═══ REGLAS DE COMPLIANCE ═══',
    complianceRules,
    channelCompliance,
    '',
    outputInstruction,
  ].filter(Boolean).join('\n')

  // Stream from Claude
  yield* streamFromClaude(userMessage, channel.id)
}

// ─── Modify pipeline (short — no full context rebuild) ───────────────────────

async function* runModifyPipeline(
  params: ModifyParams,
  channel: ReturnType<typeof getChannel>
): AsyncGenerator<string, void, unknown> {
  const instruction = params.modification === 'custom'
    ? params.custom_instruction ?? 'Mejora el contenido'
    : MODIFICATION_INSTRUCTIONS[params.modification]

  const userMessage = [
    'Modifica el siguiente contenido JSON aplicando esta instrucción.',
    '',
    'INSTRUCCIÓN DE MODIFICACIÓN:',
    instruction,
    '',
    'REGLAS ABSOLUTAS PARA LA MODIFICACIÓN:',
    '• Conserva el schema JSON exacto — mismos campos, mismos tipos',
    '• Conserva el producto y el objetivo estratégico',
    '• Conserva los elementos de compliance',
    '• Solo modifica el tono, extensión, y estilo según la instrucción',
    '',
    'CONTENIDO ACTUAL:',
    JSON.stringify(params.current_output, null, 2),
    '',
    'RETORNA ÚNICAMENTE el JSON modificado. Sin texto adicional. Sin markdown.',
  ].join('\n')

  yield* streamFromClaude(userMessage, channel.id)
}

// ─── Stream from Claude ───────────────────────────────────────────────────────

async function* streamFromClaude(
  userMessage: string,
  channelId: string
): AsyncGenerator<string, void, unknown> {
  // Token limits per channel family
  const maxTokens = getMaxTokens(channelId)

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: CONTENT_STUDIO_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaxTokens(channelId: string): number {
  const limits: Record<string, number> = {
    carousel: 2000,
    reel_script: 1800,
    tiktok_script: 1500,
    video_educativo: 3000,
    email_marketing: 2500,
    story: 800,
    whatsapp: 700,
    sms: 300,
    hook: 600,
    cta_pack: 400,
    hashtag_pack: 500,
  }
  return limits[channelId] ?? 1000 // Default for static posts
}
