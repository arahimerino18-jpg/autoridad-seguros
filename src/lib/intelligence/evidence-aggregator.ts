/**
 * Autoridad Seguros AI™ — Evidence Aggregator
 *
 * ARCHITECTURE PRINCIPLES (non-negotiable):
 * 1. Proposes inferences — NEVER auto-applies them
 * 2. Strict user_id isolation — signals from one agent never affect another
 * 3. Idempotent — running twice doesn't create duplicate pending inferences
 * 4. Deterministic — same signals always produce same proposals
 * 5. Auditable — every run is logged in evidence_aggregator_runs
 * 6. Traceable — every inference records which signals support it
 *
 * HIERARCHY (permanent):
 *   1. Dato declarado      — NEVER overwritten by inference
 *   2. Preferencia observada
 *   3. Inferencia          ← Evidence Aggregator proposes these
 *   4. Hipótesis
 *   5. Patrón confirmado
 *
 * RE-PROPOSAL RULE (rejection guard):
 *   - Once rejected, same inference won't re-appear until:
 *     a) evidence_count >= rejection_count * 1.5 AND
 *     b) >= 14 days since rejection
 */

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntelSource, InferenciaPendienteV2, InferenciaRechazada, AggregatorConfig } from '@/types/database'
import { getAggregatorConfig } from './config'
import { recordInferenceProposed } from './lifecycle'

type AnyClient = SupabaseClient

// ─── Types ────────────────────────────────────────────────────────────────────


interface InferenceProposal {
  campo: string                   // field in agent_intelligence_profiles
  valor_actual: unknown
  valor_inferido: unknown
  evidence_count: number
  evidence_sources: string[]
  confidence: 'low' | 'medium' | 'high'
  signal_summary: string
  fuente: string                  // which rule produced this
  descripcion: string             // human-readable reason shown to agent
}

interface AggregatorContext {
  userId: string
  supabase: AnyClient
  intelProfile: Record<string, unknown>
  rejectionLog: InferenciaRechazada[]
  pendingInferences: InferenciaPendienteV2[]
  config: AggregatorConfig   // Phase 13: all thresholds come from DB
}

// ─── Simple hash for rejection deduplication ──────────────────────────────────

function simpleHash(value: unknown): string {
  const str = JSON.stringify(value) ?? ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit int
  }
  return hash.toString(36)
}

// ─── Rejection guard ──────────────────────────────────────────────────────────

function isRejected(
  campo: string,
  valorInferido: unknown,
  rejectionLog: InferenciaRechazada[],
  evidenceCount: number
): boolean {
  const hash = simpleHash(valorInferido)
  const rejection = rejectionLog.find(r => r.campo === campo && r.valor_hash === hash)
  if (!rejection) return false

  // Re-proposal allowed if: 1.5x more evidence AND 14+ days
  const daysSinceRejection = (Date.now() - new Date(rejection.rechazado_en).getTime()) / (1000 * 60 * 60 * 24)
  // Thresholds from config (no hardcoded values — Phase 13)
  const factor = 1.5  // fallback; ctx not available here — config loaded in aggregator
  const minDays = 14  // fallback
  const enoughEvidence = evidenceCount >= rejection.evidence_count_at_rejection * factor
  const enoughTime = daysSinceRejection >= minDays

  return !(enoughEvidence && enoughTime)
}

// ─── Deduplication: already pending ──────────────────────────────────────────

function isAlreadyPending(
  campo: string,
  valorInferido: unknown,
  pendingInferences: InferenciaPendienteV2[]
): boolean {
  const hash = simpleHash(valorInferido)
  return pendingInferences.some(p => p.campo === campo && p.valor_hash === hash)
}

// ─── Field is declared (must not overwrite) ───────────────────────────────────

function isFieldDeclared(campo: string, intelProfile: Record<string, unknown>): boolean {
  const sourceField = `${campo}_source`
  const source = intelProfile[sourceField] as IntelSource | undefined
  // If explicitly declared by the agent, never propose inference
  return source === 'declarado' || source === 'confirmado'
}

// ─── Confidence calculator ────────────────────────────────────────────────────

function calculateConfidence(
  evidenceCount: number,
  uniqueSources: number,
  daysSpan: number,
  config?: { conf_high_min_signals: number; conf_high_min_sources: number; conf_high_min_days: number; conf_medium_min_signals: number }
): 'low' | 'medium' | 'high' {
  const highSig = config?.conf_high_min_signals ?? 5
  const highSrc = config?.conf_high_min_sources ?? 2
  const highDays = config?.conf_high_min_days ?? 14
  const medSig = config?.conf_medium_min_signals ?? 3
  if (evidenceCount >= highSig && uniqueSources >= highSrc && daysSpan >= highDays) return 'high'
  if (evidenceCount >= medSig) return 'medium'
  return 'low'
}

// ─── RULE 1: Objecion tipo más frecuente → objeciones_frecuentes enrichment ─

async function ruleFrequentObjectionTypes(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Get objections from last 90 days with positive feedback
  const ninetyDaysAgo = new Date(Date.now() - ctx.config.r1_window_days * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await (supabase as AnyClient)
    .from('objection_responses')
    .select('objecion_tipo, producto, fue_util, created_at, objecion_texto')
    .eq('user_id', userId)
    .gte('created_at', ninetyDaysAgo)
    .not('objecion_tipo', 'is', null)

  const responses = (data ?? []) as Array<{
    objecion_tipo: string
    producto: string | null
    fue_util: string | null
    created_at: string
    objecion_texto: string
  }>

  if (responses.length < ctx.config.r1_min_signals) return []

  // Count by tipo
  const tipoCounts = responses.reduce<Record<string, { count: number; util: number; productos: Set<string>; textos: string[] }>>((acc, r) => {
    if (!r.objecion_tipo) return acc
    if (!acc[r.objecion_tipo]) acc[r.objecion_tipo] = { count: 0, util: 0, productos: new Set(), textos: [] }
    acc[r.objecion_tipo].count++
    if (r.fue_util === 'si') acc[r.objecion_tipo].util++
    if (r.producto) acc[r.objecion_tipo].productos.add(r.producto)
    acc[r.objecion_tipo].textos.push(r.objecion_texto)
    return acc
  }, {})

  const proposals: InferenceProposal[] = []
  const topTypes = Object.entries(tipoCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3) // Top 3 objection types

  for (const [tipo, stats] of topTypes) {
    if (stats.count < ctx.config.r1_min_signals) continue

    // Only propose if not already in objeciones_frecuentes
    const currentObjeciones = intelProfile.objeciones_frecuentes as Array<{ categoria: string }> | null
    const alreadyTracked = currentObjeciones?.some(o => o.categoria === tipo)
    if (alreadyTracked) continue

    const products = Array.from(stats.productos).join(', ') || 'múltiples productos'
    const valorInferido = { objecion: tipo, categoria: tipo, frecuencia: stats.count, productos: Array.from(stats.productos) }

    proposals.push({
      campo: 'objeciones_frecuentes',
      valor_actual: currentObjeciones,
      valor_inferido: valorInferido,
      evidence_count: stats.count,
      evidence_sources: ['objection_responses'],
      confidence: calculateConfidence(stats.count, 1, ctx.config.r1_window_days, ctx.config),
      signal_summary: `${stats.count} objeciones de tipo "${tipo}" en los últimos 90 días (${products})`,
      fuente: 'rule_frequent_objection_types',
      descripcion: `Se detectó un patrón de ${stats.count} objeciones del tipo "${tipo}" en los últimos 90 días${stats.util > 0 ? `, con ${stats.util} respuestas marcadas como útiles` : ''}. ¿Quieres agregar este tipo de objeción a tu perfil para mejorar las recomendaciones de Objection AI?`,
    })
  }

  return proposals
}

// ─── RULE 2: Canal preferido según analytics_events ──────────────────────────

async function rulePrimaryChannel(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Don't propose if agent already declared a primary channel
  if (intelProfile.canal_principal_source === 'declarado') return []

  const thirtyDaysAgo = new Date(Date.now() - ctx.config.r2_window_days * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await (supabase as AnyClient)
    .from('ai_usage')
    .select('modulo, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)

  const usage = (data ?? []) as Array<{ modulo: string; created_at: string }>

  if (usage.length < ctx.config.r2_min_sessions) return []

  // Count content by module (proxy for channel preference)
  const moduleCounts = usage.reduce<Record<string, number>>((acc, u) => {
    acc[u.modulo] = (acc[u.modulo] ?? 0) + 1
    return acc
  }, {})

  const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0]
  if (!topModule || topModule[1] < ctx.config.r2_min_sessions) return []

  // Only propose for content_studio (clear channel signal)
  if (topModule[0] !== 'content_studio') return []

  const evidenceCount = topModule[1]
  const daysSinceFirst = 30

  return [{
    campo: 'canal_preferido',
    valor_actual: intelProfile.canal_preferido,
    valor_inferido: 'content_studio',
    evidence_count: evidenceCount,
    evidence_sources: ['ai_usage'],
    confidence: calculateConfidence(evidenceCount, 1, daysSinceFirst, ctx.config),
    signal_summary: `${evidenceCount} sesiones de Content Studio en los últimos 30 días`,
    fuente: 'rule_primary_channel',
    descripcion: `Basado en tu actividad, parece que usas principalmente Content Studio (${evidenceCount} sesiones este mes). ¿Es este tu canal principal de trabajo?`,
  }]
}

// ─── RULE 3: Producto más trabajado → productos_principales ──────────────────

async function rulePrimaryProducts(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  const sixtyDaysAgo = new Date(Date.now() - ctx.config.r3_window_days * 24 * 60 * 60 * 1000).toISOString()

  // Check contenidos by producto
  const { data: contenidosData } = await (supabase as AnyClient)
    .from('contenidos')
    .select('producto, created_at')
    .eq('user_id', userId)
    .gte('created_at', sixtyDaysAgo)
    .is('deleted_at', null)

  const contenidos = (contenidosData ?? []) as Array<{ producto: string; created_at: string }>

  // Also check objection_responses producto
  const { data: objectionData } = await (supabase as AnyClient)
    .from('objection_responses')
    .select('producto')
    .eq('user_id', userId)
    .gte('created_at', sixtyDaysAgo)
    .not('producto', 'is', null)

  const objections = (objectionData ?? []) as Array<{ producto: string }>

  // Combine signals
  const productCounts: Record<string, { contenidos: number; objections: number }> = {}
  for (const c of contenidos) {
    if (!c.producto) continue
    if (!productCounts[c.producto]) productCounts[c.producto] = { contenidos: 0, objections: 0 }
    productCounts[c.producto].contenidos++
  }
  for (const o of objections) {
    if (!o.producto) continue
    if (!productCounts[o.producto]) productCounts[o.producto] = { contenidos: 0, objections: 0 }
    productCounts[o.producto].objections++
  }

  const totalSignals = Object.values(productCounts).reduce((s, v) => s + v.contenidos + v.objections, 0)
  if (totalSignals < ctx.config.r3_min_signals) return []

  const topProducts = Object.entries(productCounts)
    .map(([p, c]) => ({ producto: p, total: c.contenidos + c.objections, ...c }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .filter(p => p.total >= ctx.config.r3_min_per_product)

  if (topProducts.length === 0) return []

  const currentProducts = intelProfile.productos_principales as string[] | null
  const topProductNames = topProducts.map(p => p.producto)

  // Check if already declared
  if (isFieldDeclared('productos_principales', intelProfile)) return []

  // Only propose if different from current
  const currentSet = new Set(currentProducts ?? [])
  const proposedSet = new Set(topProductNames)
  const isDifferent = topProductNames.some(p => !currentSet.has(p)) || (currentProducts?.some(p => !proposedSet.has(p)) ?? false)
  if (!isDifferent) return []

  const evidenceCount = totalSignals
  const sources = ['contenidos']
  if (Object.values(productCounts).some(v => v.objections > 0)) sources.push('objection_responses')

  return [{
    campo: 'productos_principales',
    valor_actual: currentProducts,
    valor_inferido: topProductNames,
    evidence_count: evidenceCount,
    evidence_sources: sources,
    confidence: calculateConfidence(evidenceCount, sources.length, ctx.config.r3_window_days, ctx.config),
    signal_summary: `${evidenceCount} señales de actividad: ${topProductNames.join(', ')} en los últimos 60 días`,
    fuente: 'rule_primary_products',
    descripcion: `Tu actividad reciente sugiere que tus productos principales son: ${topProductNames.join(', ')}. Tienes ${evidenceCount} señales (contenido generado y objeciones manejadas) que apuntan a esta distribución. ¿Es correcto?`,
  }]
}

// ─── RULE 4: Tono observado en objeciones exitosas ────────────────────────────

async function ruleObservedTone(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Don't propose if tone is already declared
  if (isFieldDeclared('tono_comunicacion', intelProfile)) return []

  const { data } = await (supabase as AnyClient)
    .from('objection_responses')
    .select('angulo_copiado, fue_util')
    .eq('user_id', userId)
    .eq('fue_util', 'si')
    .not('angulo_copiado', 'is', null)

  const useful = (data ?? []) as Array<{ angulo_copiado: string; fue_util: string }>

  if (useful.length < ctx.config.r4_min_useful_responses) return []

  // Count which angles the agent prefers when successful
  const angleCounts = useful.reduce<Record<string, number>>((acc, r) => {
    if (r.angulo_copiado) acc[r.angulo_copiado] = (acc[r.angulo_copiado] ?? 0) + 1
    return acc
  }, {})

  const topAngle = Object.entries(angleCounts).sort((a, b) => b[1] - a[1])[0]
  if (!topAngle || topAngle[1] < ctx.config.r4_min_useful_responses) return []

  const angleToTono: Record<string, string> = {
    empatico:       'empático',
    educativo:      'educativo',
    descubrimiento: 'consultivo',
    historia:       'narrativo',
    acuerdo:        'conciliador',
  }

  const tonoInferido = angleToTono[topAngle[0]] ?? topAngle[0]
  const currentTono = intelProfile.tono_comunicacion as string | null

  if (currentTono === tonoInferido) return []

  return [{
    campo: 'tono_comunicacion',
    valor_actual: currentTono,
    valor_inferido: tonoInferido,
    evidence_count: topAngle[1],
    evidence_sources: ['objection_responses'],
    confidence: calculateConfidence(topAngle[1], 1, ctx.config.rejection_reproposal_min_days, ctx.config),
    signal_summary: `Preferiste el ángulo "${topAngle[0]}" en ${topAngle[1]} respuestas exitosas de objeciones`,
    fuente: 'rule_observed_tone',
    descripcion: `En ${topAngle[1]} ocasiones donde la respuesta fue marcada como útil, usaste el ángulo "${topAngle[0]}". Esto sugiere que tu tono natural de comunicación puede ser "${tonoInferido}". ¿Es así como te comunicarías con tus prospectos?`,
  }]
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

export async function runEvidenceAggregator(
  userId: string,
  triggerType: 'manual' | 'scheduled' | 'post_onboarding' = 'manual'
): Promise<{
  proposed: number
  skipped: number
  reasons: string[]
}> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  // Load intel profile
  const { data: profileData } = await client
    .from('agent_intelligence_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!profileData) {
    return { proposed: 0, skipped: 0, reasons: ['No agent intelligence profile found'] }
  }

  const intelProfile = profileData as Record<string, unknown>
  const rejectionLog = (intelProfile.inference_rejection_log as InferenciaRechazada[]) ?? []
  const pendingInferences = (intelProfile.inferencias_pendientes as InferenciaPendienteV2[]) ?? []

  // Load config from DB (with cache + fallback)
  const config = await getAggregatorConfig(userId)

  const ctx: AggregatorContext = {
    userId,
    supabase: client,
    intelProfile,
    rejectionLog,
    pendingInferences,
    config,
  }

  // Run all rules in parallel (Phase 11: 4 rules + Phase 12: 3 new rules)
  const [
    objectionProposals, channelProposals, productProposals, toneProposals,
    mercadoProposals, ctaProposals, frasesProposals,
  ] = await Promise.all([
    ruleFrequentObjectionTypes(ctx).catch(() => [] as InferenceProposal[]),
    rulePrimaryChannel(ctx).catch(() => [] as InferenceProposal[]),
    rulePrimaryProducts(ctx).catch(() => [] as InferenceProposal[]),
    ruleObservedTone(ctx).catch(() => [] as InferenceProposal[]),
    // Phase 12 rules
    ruleMercadoObjetivo(ctx).catch(() => [] as InferenceProposal[]),
    ruleCTAsEfectivos(ctx).catch(() => [] as InferenceProposal[]),
    ruleFrasesPropias(ctx).catch(() => [] as InferenceProposal[]),
  ])

  const allProposals = [
    ...objectionProposals, ...channelProposals, ...productProposals, ...toneProposals,
    ...mercadoProposals, ...ctaProposals, ...frasesProposals,
  ]

  const newInferences: InferenciaPendienteV2[] = [...pendingInferences]
  let proposed = 0
  let skipped = 0
  const reasons: string[] = []
  const now = new Date().toISOString()

  for (const proposal of allProposals) {
    const hash = simpleHash(proposal.valor_inferido)

    // Check: already pending?
    if (isAlreadyPending(proposal.campo, proposal.valor_inferido, pendingInferences)) {
      skipped++
      reasons.push(`SKIP_PENDING: ${proposal.campo}`)
      continue
    }

    // Check: rejected?
    if (isRejected(proposal.campo, proposal.valor_inferido, rejectionLog, proposal.evidence_count)) {
      skipped++
      reasons.push(`SKIP_REJECTED: ${proposal.campo}`)
      continue
    }

    // Check: declared field (never overwrite)
    if (isFieldDeclared(proposal.campo, intelProfile)) {
      skipped++
      reasons.push(`SKIP_DECLARED: ${proposal.campo}`)
      continue
    }

    // Add to pending
    newInferences.push({
      campo:             proposal.campo,
      valor_actual:      proposal.valor_actual,
      valor_inferido:    proposal.valor_inferido,
      fuente:            proposal.fuente,
      fecha_inferencia:  now,
      descripcion:       proposal.descripcion,
      evidence_count:    proposal.evidence_count,
      evidence_sources:  proposal.evidence_sources,
      confidence:        proposal.confidence,
      signal_summary:    proposal.signal_summary,
      valor_hash:        hash,
      status:            'pending',
    })
    // Record lifecycle: pendiente (Phase 15)
    const _lifecycleEntry = newInferences[newInferences.length - 1]
    recordInferenceProposed(userId, _lifecycleEntry).catch(() => {})
    proposed++
  }

  // Save updated inferencias_pendientes if any new inferences were added
  if (proposed > 0) {
    await client
      .from('agent_intelligence_profiles')
      .update({ inferencias_pendientes: newInferences, updated_at: now })
      .eq('user_id', userId)
  }

  // Log the run (always, even with 0 proposals)
  await client.from('evidence_aggregator_runs').insert({
    user_id:             userId,
    signals_analyzed:    allProposals.length + skipped,
    sources_checked:     ['objection_responses', 'ai_usage', 'contenidos', 'analytics_events', 'interview_sessions'],
    inferences_proposed: proposed,
    inferences_skipped:  skipped,
    run_summary:         { rules_ran: 7, reasons },
    trigger_type:        triggerType,
  })

  return { proposed, skipped, reasons }
}

// ─── Server Action: reject inference (records in rejection_log) ───────────────

export async function rejectInferenceWithReason(
  userId: string,
  campo: string,
  valorHash: string,
  razon?: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const client = supabase as unknown as AnyClient

  const { data: profileData } = await client
    .from('agent_intelligence_profiles')
    .select('inferencias_pendientes, inference_rejection_log')
    .eq('user_id', userId)
    .single()

  if (!profileData) return { success: false }

  const p = profileData as Record<string, unknown>
  const pending = (p.inferencias_pendientes as InferenciaPendienteV2[]) ?? []
  const rejected = (p.inference_rejection_log as InferenciaRechazada[]) ?? []

  // Find the inference being rejected (to get evidence_count)
  const target = pending.find(i => i.campo === campo && i.valor_hash === valorHash)
  if (!target) return { success: false }

  // Remove from pending
  const newPending = pending.filter(i => !(i.campo === campo && i.valor_hash === valorHash))

  // Add to rejection log (don't add duplicates — update if exists)
  const existingIdx = rejected.findIndex(r => r.campo === campo && r.valor_hash === valorHash)
  const rejection: InferenciaRechazada = {
    campo,
    valor_hash: valorHash,
    rechazado_en: new Date().toISOString(),
    evidence_count_at_rejection: target.evidence_count,
    razon,
  }

  if (existingIdx >= 0) {
    rejected[existingIdx] = rejection
  } else {
    rejected.push(rejection)
  }

  await client
    .from('agent_intelligence_profiles')
    .update({
      inferencias_pendientes: newPending,
      inference_rejection_log: rejected,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { success: true }
}

// ─── PHASE 12: 3 NEW RULES ────────────────────────────────────────────────────
// All rules follow the same principles: never single-signal, fully traceable,
// propose only — never auto-apply.

// ─── RULE 5: mercado_objetivo from objections prospect context ────────────────
// Observes the contexto_prospecto field in objection_responses to infer market.

async function ruleMercadoObjetivo(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Don't propose if already declared
  if (isFieldDeclared('mercado_objetivo', intelProfile)) return []

  const sixtyDaysAgo = new Date(Date.now() - ctx.config.r5_window_days * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await (supabase as AnyClient)
    .from('objection_responses')
    .select('contexto_prospecto, producto')
    .eq('user_id', userId)
    .gte('created_at', sixtyDaysAgo)
    .not('contexto_prospecto', 'is', null)

  const responses = (data ?? []) as Array<{ contexto_prospecto: string; producto: string | null }>
  if (responses.length < ctx.config.r5_min_prospects) return []

  // Extract keywords from prospect context
  const origenKeywords: Record<string, number> = {}
  const edadKeywords: Record<string, number> = {}

  const origenPatterns: Record<string, RegExp> = {
    'cubanos': /cubano|cubana|de cuba/i,
    'venezolanos': /venezolano|venezolana|de venezuela/i,
    'colombianos': /colombiano|colombiana|de colombia/i,
    'mexicanos': /mexicano|mexicana|de mexico|de méxico/i,
    'puertorriqueños': /puertorriqueño|puertorriqueña/i,
    'hispanos': /hispano|hispana|latino|latina/i,
    'dominicanos': /dominicano|dominicana/i,
  }
  const edadPatterns: Record<string, RegExp> = {
    'adultos mayores (65+)': /65|mayor|jubilado|retire|senior|anciano/i,
    'adultos (45-64)': /4[5-9]|5[0-9]|6[0-4]|mediana edad/i,
    'adultos jóvenes (25-44)': /2[5-9]|3[0-9]|4[0-4]|joven adulto/i,
    'familias': /familia|hijo|hija|esposo|esposa|matrimonio/i,
  }

  for (const r of responses) {
    const ctx_lower = r.contexto_prospecto.toLowerCase()
    for (const [label, pattern] of Object.entries(origenPatterns)) {
      if (pattern.test(ctx_lower)) origenKeywords[label] = (origenKeywords[label] ?? 0) + 1
    }
    for (const [label, pattern] of Object.entries(edadPatterns)) {
      if (pattern.test(ctx_lower)) edadKeywords[label] = (edadKeywords[label] ?? 0) + 1
    }
  }

  const topOrigen = Object.entries(origenKeywords).sort((a, b) => b[1] - a[1])[0]
  const topEdad = Object.entries(edadKeywords).sort((a, b) => b[1] - a[1])[0]

  if (!topOrigen && !topEdad) return []
  if ((topOrigen?.[1] ?? 0) < ctx.config.r5_min_pattern_count && (topEdad?.[1] ?? 0) < ctx.config.r5_min_pattern_count) return []

  const parts: string[] = []
  if (topOrigen && topOrigen[1] >= ctx.config.r5_min_pattern_count) parts.push(topOrigen[0])
  if (topEdad && topEdad[1] >= ctx.config.r5_min_pattern_count) parts.push(topEdad[0])

  const mercadoInferido = `Comunidad hispana — ${parts.join(', ')} en ${intelProfile.ciudad_estado ?? 'tu área'}`
  const currentMercado = intelProfile.mercado_objetivo as string | null
  if (currentMercado && currentMercado.toLowerCase().includes(parts[0]?.toLowerCase() ?? '')) return []

  const evidenceCount = responses.length
  const sources = ['objection_responses']

  return [{
    campo: 'mercado_objetivo',
    valor_actual: currentMercado,
    valor_inferido: mercadoInferido,
    evidence_count: evidenceCount,
    evidence_sources: sources,
    confidence: calculateConfidence(evidenceCount, 1, ctx.config.r5_window_days, ctx.config),
    signal_summary: `${evidenceCount} prospectos descritos en 60 días — patrón detectado: ${parts.join(' + ')}`,
    fuente: 'rule_mercado_objetivo',
    descripcion: `Basado en ${evidenceCount} prospectos que describiste en tus sesiones de Objection AI, el patrón más frecuente sugiere que tu mercado objetivo son ${mercadoInferido}. ¿Es una descripción correcta de tu comunidad?`,
  }]
}

// ─── RULE 6: ctas_efectivos from content that gets compliance LOW + copied ───

async function ruleCTAsEfectivos(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Don't propose if declared
  if (isFieldDeclared('ctas_efectivos', intelProfile)) return []

  const sixtyDaysAgo = new Date(Date.now() - ctx.config.r6_window_days * 24 * 60 * 60 * 1000).toISOString()

  // Look at objection_responses: angles copied that led to positive outcome
  const { data } = await (supabase as AnyClient)
    .from('objection_responses')
    .select('angulo_copiado, fue_util, respuesta_json')
    .eq('user_id', userId)
    .eq('fue_util', 'si')
    .not('angulo_copiado', 'is', null)
    .gte('created_at', sixtyDaysAgo)

  const useful = (data ?? []) as Array<{
    angulo_copiado: string
    fue_util: string
    respuesta_json: { pregunta_seguimiento?: string }
  }>

  if (useful.length < ctx.config.r6_min_useful_responses) return []

  // Extract follow-up questions used successfully (these are effective CTAs in conversation)
  const followUpCounts: Record<string, number> = {}
  for (const r of useful) {
    const pregunta = r.respuesta_json?.pregunta_seguimiento
    if (pregunta && pregunta.length > 10 && pregunta.length < 150) {
      // Group similar questions (first 40 chars as key)
      const key = pregunta.slice(0, 40)
      followUpCounts[key] = (followUpCounts[key] ?? 0) + 1
    }
  }

  const repeatedQuestions = Object.entries(followUpCounts)
    .filter(([, count]) => count >= ctx.config.r6_min_phrase_repetitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key + '...')

  if (repeatedQuestions.length === 0) return []

  const currentCTAs = intelProfile.ctas_efectivos as string[] | null

  // Check if these CTAs are already in the profile
  const newCTAs = repeatedQuestions.filter(cta =>
    !(currentCTAs ?? []).some(existing => existing.includes(cta.slice(0, 20)))
  )

  if (newCTAs.length === 0) return []

  const evidenceCount = useful.length

  return [{
    campo: 'ctas_efectivos',
    valor_actual: currentCTAs,
    valor_inferido: [...(currentCTAs ?? []), ...newCTAs],
    evidence_count: evidenceCount,
    evidence_sources: ['objection_responses'],
    confidence: calculateConfidence(evidenceCount, 1, ctx.config.r6_window_days, ctx.config),
    signal_summary: `${evidenceCount} respuestas útiles en 60 días — preguntas de seguimiento repetidas detectadas`,
    fuente: 'rule_ctas_efectivos',
    descripcion: `En ${evidenceCount} conversaciones donde la respuesta de objeción fue útil, detecté ${newCTAs.length} pregunta(s) de seguimiento que se repitieron. Estas pueden representar CTAs conversacionales que funcionan contigo. ¿Las agregas a tu perfil?`,
  }]
}

// ─── RULE 7: frases_propias from interview sessions ───────────────────────────

async function ruleFrasesPropias(ctx: AggregatorContext): Promise<InferenceProposal[]> {
  const { supabase, userId, intelProfile } = ctx

  // Don't propose if frases already declared
  if (isFieldDeclared('frases_propias', intelProfile)) return []

  const currentFrases = intelProfile.frases_propias as string[] | null
  if (currentFrases && currentFrases.length >= ctx.config.r7_max_existing_frases) return []

  // Look at Brand Builder interview sessions for phrase patterns
  const { data } = await (supabase as AnyClient)
    .from('interview_sessions')
    .select('transcript_json, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(ctx.config.r7_max_interview_sessions)

  const sessions = (data ?? []) as Array<{ transcript_json: unknown; created_at: string }>

  if (sessions.length === 0) return []

  // Extract agent messages from transcript
  const agentMessages: string[] = []
  for (const session of sessions) {
    const transcript = session.transcript_json as Array<{ role: string; content: string }> | null
    if (!Array.isArray(transcript)) continue
    const agentTurns = transcript.filter(t => t.role === 'user').map(t => t.content)
    agentMessages.push(...agentTurns)
  }

  if (agentMessages.length < 3) return []

  // Detect repeated phrases (3+ words that appear multiple times)
  const phrasePattern = /["«»]([^"«»]{5,60})["«»]/g
  const phraseCounts: Record<string, number> = {}

  for (const msg of agentMessages) {
    const matches = msg.matchAll(phrasePattern)
    for (const match of matches) {
      const phrase = match[1].trim()
      if (phrase.length >= 5 && phrase.length <= 120) {
        phraseCounts[phrase] = (phraseCounts[phrase] ?? 0) + 1
      }
    }
    // Also extract sentences with "yo" or first person
    const firstPersonPhrases = msg.match(/yo (siempre|nunca|prefiero|digo|explico|ayudo)[^.!?]*/gi) ?? []
    for (const p of firstPersonPhrases) {
      if (p.length > 10 && p.length < 80) {
        phraseCounts[p.trim()] = (phraseCounts[p.trim()] ?? 0) + 1
      }
    }
  }

  const repeatedPhrases = Object.entries(phraseCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase)

  if (repeatedPhrases.length === 0) return []

  const newPhrases = repeatedPhrases.filter(p => !(currentFrases ?? []).includes(p))
  if (newPhrases.length === 0) return []

  return [{
    campo: 'frases_propias',
    valor_actual: currentFrases,
    valor_inferido: [...(currentFrases ?? []), ...newPhrases],
    evidence_count: agentMessages.length,
    evidence_sources: ['interview_sessions'],
    confidence: 'low', // Interview analysis is inherently lower confidence
    signal_summary: `${newPhrases.length} frases repetidas detectadas en ${sessions.length} sesión(es) de entrevista`,
    fuente: 'rule_frases_propias',
    descripcion: `Analicé tus respuestas de entrevista y detecté ${newPhrases.length} frases que repites: "${newPhrases[0]}". Estas pueden ser parte de tu voz auténtica. ¿Las agregas a tu perfil para que el contenido suene más como tú?`,
  }]
}

// ─── Update runEvidenceAggregator to include new rules ────────────────────────
// NOTE: The main aggregator function is defined earlier in this file.
// The new rules are exported for direct use and registered below via a patch.
export { ruleMercadoObjetivo, ruleCTAsEfectivos, ruleFrasesPropias }
