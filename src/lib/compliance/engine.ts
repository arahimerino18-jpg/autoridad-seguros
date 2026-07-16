/**
 * Autoridad Seguros AI™ — Compliance Engine
 *
 * ARCHITECTURE: 4-layer pipeline
 *   Layer 1 — Deterministic Rules Engine (fast, cheap, no AI)
 *   Layer 2 — AI Compliance Analysis (only when Layer 1 detects MEDIUM+ or content is complex)
 *   Layer 3 — Structured Risk Result (merged output)
 *   Layer 4 — Human Review Recommendation
 *
 * IMPORTANT DISCLAIMER (reflected in all user-facing output):
 *   This system is a risk support tool.
 *   It does NOT certify legal compliance.
 *   It does NOT replace legal counsel, carrier review, or CMS-approved materials.
 *   It does NOT guarantee regulatory compliance.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ComplianceIssue {
  category: string
  rule_id?: string
  risk_level: RiskLevel
  problematic_text: string       // The exact phrase that triggered the issue
  explanation: string            // Why this is a concern
  recommended_revision: string   // Suggested replacement
  source: 'deterministic' | 'ai' // Which layer detected it
}

export interface ComplianceResult {
  risk_level: RiskLevel
  overall_summary: string
  detected_issues: ComplianceIssue[]
  requires_human_review: boolean
  product_context: string
  channel_context: string
  compliance_notes: string[]
  disclaimer: string
  // Layer 1 metadata
  deterministic_issues_count: number
  // Cost optimization metadata
  ai_layer_used: boolean
  processing_time_ms: number
  // Phase 11: DB cache traceability
  rules_source: 'db' | 'fallback'
}

// ─── Layer 1: Deterministic Rules ────────────────────────────────────────────
// Inline rule set — seeded from migration 009 for MVP.
// Future: load from compliance_rules table for hot-reload without deployment.

interface DeterministicRule {
  rule_id: string
  category: string
  severity: RiskLevel
  pattern: RegExp | string   // string = simple keyword match (case-insensitive)
  description: string
  recommendation: string
  products?: string[]        // empty = all products
}

const DETERMINISTIC_RULES: DeterministicRule[] = [
  // Absolute claims
  { rule_id: 'CLAIM_GARANTIZADO',   category: 'absolute_claim',   severity: 'HIGH',   pattern: /garantizad[oa]/i,    description: 'Uso de "garantizado" puede crear expectativa falsa de aprobación o cobertura.', recommendation: 'Reemplaza con "puede calificar para" o "generalmente incluye".' },
  { rule_id: 'CLAIM_GARANTIZA',     category: 'absolute_claim',   severity: 'HIGH',   pattern: /\bgarantiza\b/i,     description: 'Garantías absolutas no están permitidas en marketing de seguros.',            recommendation: 'Usa lenguaje condicional: "si califica" o "en la mayoría de los casos".' },
  { rule_id: 'CLAIM_GRATIS',        category: 'absolute_claim',   severity: 'MEDIUM', pattern: /completamente gratis/i, description: 'Nada en seguros es "completamente gratis".',                              recommendation: 'Especifica qué es sin costo adicional y bajo qué condiciones.' },
  { rule_id: 'CLAIM_SIN_COSTO',     category: 'absolute_claim',   severity: 'MEDIUM', pattern: /sin costo/i,         description: 'Puede ser engañoso sin aclarar que se requiere calificación.',              recommendation: 'Agrega: "sujeto a calificación" o especifica qué tiene costo cero.' },
  { rule_id: 'CLAIM_MEJOR',         category: 'absolute_claim',   severity: 'MEDIUM', pattern: /\bel mejor\b/i,      description: 'Superlativo sin evidencia.',                                               recommendation: 'Usa "una de las mejores opciones" o describe el beneficio específico.' },
  { rule_id: 'CLAIM_APROBACION',    category: 'absolute_claim',   severity: 'HIGH',   pattern: /aprobaci[oó]n garantizada/i, description: 'Ningún seguro puede garantizar aprobación.', recommendation: 'Usa "sin preguntas de salud" solo si el producto lo permite.' },
  { rule_id: 'CLAIM_SIN_RECHAZO',   category: 'absolute_claim',   severity: 'HIGH',   pattern: /sin rechazo/i,       description: 'Promesa de no rechazo puede ser incorrecta.',                             recommendation: 'Verifica que el producto sea guaranteed issue antes de usarlo.' },

  // Financial promises
  { rule_id: 'FIN_RENDIMIENTO',     category: 'financial_promise', severity: 'HIGH',   pattern: /rendimiento garantizado/i, description: 'Productos indexados no garantizan rendimientos.',                 recommendation: 'Usa "potencial de crecimiento vinculado al índice".', products: ['iul'] },
  { rule_id: 'FIN_GANA_SIEMPRE',    category: 'financial_promise', severity: 'HIGH',   pattern: /siempre gana/i,      description: 'No existe producto financiero que siempre genere ganancias.',           recommendation: 'Describe el mecanismo real: piso y techo del índice.' },
  { rule_id: 'FIN_DUPLICA',         category: 'financial_promise', severity: 'HIGH',   pattern: /duplica tu dinero/i, description: 'Promesa de duplicación sin contexto es engañosa.',                     recommendation: 'Muestra proyecciones reales con escenarios ilustrativos.' },
  { rule_id: 'FIN_RETIRO',          category: 'financial_promise', severity: 'MEDIUM', pattern: /\bretiro\b/i,        description: 'La palabra "retiro" puede confundir un seguro con un plan de retiro.',   recommendation: 'Usa "valores en efectivo disponibles" o "acceso a fondos acumulados".', products: ['iul', 'life'] },

  // Medicare specific
  { rule_id: 'MED_GOVT',            category: 'medicare_risk',    severity: 'HIGH',   pattern: /gobierno te da/i,    description: 'Medicare no "da" beneficios — son servicios a los que califica.',       recommendation: 'Usa: "puede calificar para beneficios de Medicare Advantage".', products: ['medicare'] },
  { rule_id: 'MED_GRATIS',          category: 'medicare_risk',    severity: 'HIGH',   pattern: /medicare gratis/i,   description: 'Medicare Advantage no es completamente gratis.',                       recommendation: 'Especifica "$0 prima mensual" solo si el plan lo permite.', products: ['medicare'] },
  { rule_id: 'MED_TODOS',           category: 'medicare_risk',    severity: 'HIGH',   pattern: /todos califican/i,   description: 'No todos califican para todos los planes.',                            recommendation: 'Usa "si califica" o "disponible en tu área".' },
  { rule_id: 'MED_GOVT_APRUEBA',    category: 'medicare_risk',    severity: 'HIGH',   pattern: /aprobado por el gobierno/i, description: 'Puede implicar endorsement gubernamental.',                   recommendation: 'Los planes MA son de aseguradoras privadas aprobadas por CMS.', products: ['medicare'] },

  // Government impersonation
  { rule_id: 'GOV_LLAMA',           category: 'government_impersonation', severity: 'HIGH', pattern: /llamamos de medicare/i, description: 'Puede crear impresión de ser empleado federal.',             recommendation: 'Aclara que representas a una aseguradora privada.' },
  { rule_id: 'GOV_DEPARTAMENTO',    category: 'government_impersonation', severity: 'HIGH', pattern: /departamento de (salud|medicare|seguro social)/i, description: 'Puede confundirse con agencia gubernamental.', recommendation: 'Usa el nombre real de tu agencia.' },

  // Fear-based selling
  { rule_id: 'FEAR_PERDER_TODO',    category: 'fear_selling',     severity: 'MEDIUM', pattern: /perder[aá]s todo/i,  description: 'Lenguaje de miedo extremo puede ser considerado coercitivo.',          recommendation: 'Enfoca en protección, no en el miedo a la pérdida.' },

  // CTA urgency
  { rule_id: 'CTA_URGENCIA',        category: 'cta_risk',         severity: 'MEDIUM', pattern: /solo por hoy/i,      description: 'Urgencia artificial puede ser considerada presión indebida.',          recommendation: 'Si hay un plazo real, menciónalo con la fecha exacta.' },
  { rule_id: 'CTA_ULTIMA_OPORT',    category: 'cta_risk',         severity: 'MEDIUM', pattern: /[uú]ltima oportunidad/i, description: 'Urgencia falsa es una práctica cuestionable.',                 recommendation: 'Usa fechas reales de período de inscripción cuando aplique.' },

  // Product comparisons
  { rule_id: 'COMP_SIN_EVIDENCIA',  category: 'product_comparison', severity: 'MEDIUM', pattern: /mejor que (el|la|los|las)? ?[a-záéíóúñ]+/i, description: 'Comparación sin evidencia puede ser engañosa.', recommendation: 'Cita la fuente o evita comparaciones directas sin sustento.' },
]

// ─── Layer 2: AI Analysis ─────────────────────────────────────────────────────
// Only called when: (a) deterministic layer found MEDIUM+ issues, or
//                  (b) content length > 200 chars (complex enough to need AI)
//                  (c) force=true

const AI_COMPLIANCE_SYSTEM_PROMPT = `Eres un especialista en compliance de marketing para seguros en Estados Unidos, con enfoque en el mercado hispano.

FUNCIÓN: Identificar riesgos de compliance en contenido de marketing de seguros.

IMPORTANTE — LIMITACIONES (debes comunicarlas si detectas riesgos altos):
- Este análisis NO certifica cumplimiento legal.
- NO reemplaza revisión de asesor legal, carrier, o materiales aprobados por CMS.
- NO garantiza cumplimiento regulatorio.
- Es una herramienta de apoyo preventiva para el agente.

CATEGORÍAS DE RIESGO A DETECTAR:
1. absolute_claim — Afirmaciones absolutas sin sustento ("garantizado", "el mejor", "sin riesgo")
2. financial_promise — Promesas de rendimiento o retorno financiero
3. misleading_language — Lenguaje potencialmente engañoso o ambiguo
4. fear_selling — Presión indebida o fear-based selling excesivo
5. unverified_benefits — Referencias a beneficios no verificadas o exageradas
6. insurance_terminology — Uso incorrecto o ambiguo de términos de seguros
7. medicare_risk — Riesgos específicos de Medicare (gobierno, aprobación, gratis)
8. cta_risk — CTA potencialmente problemático (urgencia falsa, presión)
9. disclosure_omission — Omisión probable de disclosure necesario
10. education_vs_recommendation — Confusión entre educación y recomendación personalizada
11. government_impersonation — Contenido que parezca representar agencia gubernamental
12. product_comparison — Comparaciones sin evidencia suficiente

NIVELES DE RIESGO:
- LOW: El contenido es apropiado. Sugerencias menores de mejora.
- MEDIUM: Hay elementos que pueden generar confusión o riesgo moderado. Revisión recomendada.
- HIGH: Hay afirmaciones que pueden ser engañosas o violar regulaciones. Revisión humana requerida.

REGLA CRÍTICA: Sé específico. Si no ves un problema real, dilo claramente con nivel LOW.
No generes problemas donde no los hay. Un contenido correcto debe recibir LOW.

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional):
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "overall_summary": "Resumen conciso de 1-2 oraciones sobre el nivel de riesgo general",
  "detected_issues": [
    {
      "category": "nombre_categoria",
      "risk_level": "LOW" | "MEDIUM" | "HIGH",
      "problematic_text": "el texto exacto del contenido que genera la alerta",
      "explanation": "por qué esto es un riesgo de compliance",
      "recommended_revision": "cómo reescribir esta parte específica",
      "source": "ai"
    }
  ],
  "requires_human_review": true | false,
  "compliance_notes": ["nota 1", "nota 2"],
  "product_notes": "observaciones específicas sobre este producto"
}`

async function runAIAnalysis(
  contenido: string,
  producto: string,
  canal: string,
  deterministicIssues: ComplianceIssue[]
): Promise<{
  risk_level: RiskLevel
  overall_summary: string
  detected_issues: ComplianceIssue[]
  requires_human_review: boolean
  compliance_notes: string[]
}> {
  const deterministicSummary = deterministicIssues.length > 0
    ? `\n\nPROBLEMAS YA DETECTADOS (no los dupliques):\n${deterministicIssues.map(i => `- [${i.category}] "${i.problematic_text}"`).join('\n')}`
    : '\n\nLa capa determinística no encontró problemas obvios. Analiza el contenido más profundamente.'

  const userMessage = [
    `Producto: ${producto}`,
    `Canal: ${canal}`,
    deterministicSummary,
    '\n=== CONTENIDO A REVISAR ===',
    contenido,
  ].join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: AI_COMPLIANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    const parsed = JSON.parse(clean) as {
      risk_level: RiskLevel
      overall_summary: string
      detected_issues: ComplianceIssue[]
      requires_human_review: boolean
      compliance_notes: string[]
    }

    // Ensure source tag on AI issues
    parsed.detected_issues = (parsed.detected_issues ?? []).map(issue => ({
      ...issue,
      source: 'ai' as const,
    }))

    return parsed
  } catch {
    return {
      risk_level: 'MEDIUM',
      overall_summary: 'No se pudo completar el análisis automático. Revisa el contenido manualmente.',
      detected_issues: [],
      requires_human_review: true,
      compliance_notes: ['Análisis de IA no disponible. Se recomienda revisión manual.'],
    }
  }
}

// ─── Layer 3: Result aggregation ──────────────────────────────────────────────

function mergeResults(
  deterministicIssues: ComplianceIssue[],
  aiResult: Awaited<ReturnType<typeof runAIAnalysis>> | null,
  producto: string,
  canal: string,
  aiUsed: boolean,
  startTime: number
): Omit<ComplianceResult, 'rules_source'> {
  // Merge issues — deduplicate by similar problematic_text
  const allIssues = [...deterministicIssues]
  if (aiResult?.detected_issues) {
    for (const aiIssue of aiResult.detected_issues) {
      // Skip if deterministic already caught the same text
      const isDuplicate = deterministicIssues.some(d =>
        d.problematic_text.toLowerCase().includes(aiIssue.problematic_text.toLowerCase()) ||
        aiIssue.problematic_text.toLowerCase().includes(d.problematic_text.toLowerCase())
      )
      if (!isDuplicate) allIssues.push(aiIssue)
    }
  }

  // Determine overall risk level (worst of all)
  const levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH']
  const deterministicMaxLevel = deterministicIssues.reduce<RiskLevel>((max, i) => {
    return levels.indexOf(i.risk_level) > levels.indexOf(max) ? i.risk_level : max
  }, 'LOW')
  const aiMaxLevel = aiResult?.risk_level ?? 'LOW'
  const finalRiskLevel = levels.indexOf(deterministicMaxLevel) >= levels.indexOf(aiMaxLevel)
    ? deterministicMaxLevel
    : aiMaxLevel

  const requiresHuman = finalRiskLevel === 'HIGH' || (aiResult?.requires_human_review ?? false)

  const summary = aiResult?.overall_summary ?? (
    allIssues.length === 0
      ? 'El contenido no presenta problemas de compliance detectados.'
      : `Se detectaron ${allIssues.length} punto(s) que requieren atención.`
  )

  const productContext: Record<string, string> = {
    medicare:      'Medicare Advantage — regulado por CMS. Requiere lenguaje específico y no puede implicar endorsement gubernamental.',
    aca:           'ACA/Salud — los subsidios dependen de ingresos verificados. No garantizar montos.',
    iul:           'IUL — seguro de vida con componente indexado. No garantizar rendimientos.',
    final_expense: 'Gastos finales — cobertura limitada al monto aprobado.',
    life:          'Seguro de vida — beneficio por fallecimiento. No confundir con ahorro o retiro.',
    mortgage:      'Protección hipotecaria — beneficio específico para cubrir hipoteca.',
    general:       'Contenido general de seguros.',
  }

  const channelContext: Record<string, string> = {
    instagram:     'Instagram — audiencia amplia, mayor riesgo de malinterpretación en claims cortos.',
    facebook:      'Facebook — posible audiencia senior, mayor responsabilidad en claims de Medicare.',
    whatsapp:      'WhatsApp — comunicación directa, el lenguaje debe ser apropiado para conversación personal.',
    tiktok:        'TikTok — audiencia joven, evitar promesas financieras que parezcan inversiones.',
    email:         'Email — canal formal, incluir disclaimers apropiados.',
    linkedin:      'LinkedIn — audiencia profesional, lenguaje preciso y referenciado.',
    reel:          'Video corto — los claims deben ser precisos incluso en formato breve.',
  }

  const notes = [
    ...(aiResult?.compliance_notes ?? []),
    '⚖️ Esta revisión es una herramienta de apoyo. No certifica cumplimiento legal ni regulatorio.',
    '📋 Para contenido de Medicare, verifica con las guías actuales de CMS antes de publicar.',
  ]

  return {
    risk_level:                 finalRiskLevel,
    overall_summary:            summary,
    detected_issues:            allIssues,
    requires_human_review:      requiresHuman,
    product_context:            productContext[producto] ?? productContext.general,
    channel_context:            channelContext[canal] ?? `Canal: ${canal}`,
    compliance_notes:           notes,
    disclaimer:                 'Este análisis de compliance es una herramienta de apoyo preventiva. No reemplaza revisión legal, del carrier, o materiales aprobados por CMS. No certifica cumplimiento regulatorio.',
    deterministic_issues_count: deterministicIssues.length,
    ai_layer_used:              aiUsed,
    processing_time_ms:         Date.now() - startTime,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RunComplianceParams {
  contenido: string
  producto: string
  canal: string
  force_ai?: boolean    // Skip cost optimization, always run AI
  agent_context?: string // Optional: agent intelligence profile summary
}

export async function runComplianceEngine(params: RunComplianceParams): Promise<ComplianceResult> {
  const startTime = Date.now()
  const { contenido, producto, canal, force_ai = false } = params

  if (!contenido?.trim()) {
    return {
      risk_level: 'LOW',
      overall_summary: 'No hay contenido para revisar.',
      detected_issues: [],
      requires_human_review: false,
      product_context: '',
      channel_context: '',
      compliance_notes: [],
      disclaimer: '',
      deterministic_issues_count: 0,
      ai_layer_used: false,
      processing_time_ms: 0,
      rules_source: 'fallback',
    }
  }

  // Layer 1: Deterministic (DB-aware with cache + fallback)
  const { issues: deterministicIssues, rules_source } = await runDeterministicRulesWithCache(contenido, producto)

  // Decide if AI layer is needed
  const hasHighRisk = deterministicIssues.some(i => i.risk_level === 'HIGH')
  const hasMediumRisk = deterministicIssues.some(i => i.risk_level === 'MEDIUM')
  const isComplexContent = contenido.length > 200
  const needsAI = force_ai || hasHighRisk || hasMediumRisk || isComplexContent

  // Layer 2: AI (conditional)
  let aiResult: Awaited<ReturnType<typeof runAIAnalysis>> | null = null
  if (needsAI) {
    aiResult = await runAIAnalysis(contenido, producto, canal, deterministicIssues)
  }

  // Layer 3: Merge and return (now includes rules_source)
  const merged = mergeResults(deterministicIssues, aiResult, producto, canal, needsAI, startTime)
  return { ...merged, rules_source }
}

// Re-export types for use in API routes and components
export type { ComplianceResult as ComplianceEngineResult }

// ─── COMPLIANCE RULES: DB Cache Layer (Phase 11) ──────────────────────────────
//
// Strategy: module-level in-memory cache with 5-minute TTL.
// Source priority: DB → fallback to DETERMINISTIC_RULES inline.
//
// TTL: 5 minutes (rules don't change frequently; this prevents unnecessary DB
//      reads while allowing hot-updates without deployment).
//
// Fallback: if DB is unavailable or returns no rows, DETERMINISTIC_RULES are used.
//           The result includes a flag identifying which source was used.
//
// Failure mode: FAIL-SAFE — DB error → log + use fallback → never block compliance check.
// Traceability: every ComplianceResult now includes rules_source field.

interface RulesCacheEntry {
  rules: DeterministicRule[]
  loaded_at: number            // Date.now()
  source: 'db' | 'fallback'
}

// Module-level singleton cache (lives for the duration of the serverless invocation)
// In Next.js: this is shared across requests in the same worker process.
let _rulesCache: RulesCacheEntry | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function isCacheValid(): boolean {
  if (!_rulesCache) return false
  return (Date.now() - _rulesCache.loaded_at) < CACHE_TTL_MS
}

/**
 * Loads compliance rules from DB with in-memory cache and inline fallback.
 * Never throws — always returns usable rules.
 */
async function getActiveRules(): Promise<{ rules: DeterministicRule[]; source: 'db' | 'fallback' }> {
  // Return cache if valid
  if (isCacheValid() && _rulesCache) {
    return { rules: _rulesCache.rules, source: _rulesCache.source }
  }

  try {
    // Dynamic import to avoid circular deps and allow server-only usage
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('compliance_rules')
    .select('rule_id, category, severity, pattern_type, pattern_value, description, recommendation, products, active')
    .eq('active', true)
    .order('category')

    if (error || !data || (data as unknown[]).length === 0) {
      throw new Error(error ? String(error) : 'No rules returned from DB')
    }

    // Convert DB rows to DeterministicRule format
    const dbRules: DeterministicRule[] = (data as Array<{
      rule_id: string
      category: string
      severity: string
      pattern_type: string
      pattern_value: string
      description: string
      recommendation: string
      products: string[] | null
    }>).map(row => ({
      rule_id:        row.rule_id,
      category:       row.category,
      severity:       row.severity as RiskLevel,
      pattern:        row.pattern_type === 'regex'
        ? new RegExp(row.pattern_value, 'i')
        : row.pattern_value,
      description:    row.description,
      recommendation: row.recommendation,
      products:       row.products ?? [],
    }))

    _rulesCache = { rules: dbRules, loaded_at: Date.now(), source: 'db' }
    return { rules: dbRules, source: 'db' }

  } catch (err) {
    // FAIL-SAFE: log and use inline fallback
    console.warn('[Compliance] DB rules unavailable, using inline fallback:', err instanceof Error ? err.message : err)
    _rulesCache = { rules: DETERMINISTIC_RULES, loaded_at: Date.now(), source: 'fallback' }
    return { rules: DETERMINISTIC_RULES, source: 'fallback' }
  }
}

/**
 * Invalidates the rules cache (useful after admin updates to compliance_rules table).
 */
export function invalidateComplianceRulesCache(): void {
  _rulesCache = null
}

/**
 * Returns cache status for diagnostics and traceability.
 */
export function getComplianceRulesCacheStatus(): {
  cached: boolean
  source: 'db' | 'fallback' | 'none'
  age_seconds: number | null
  rules_count: number
} {
  if (!_rulesCache) return { cached: false, source: 'none', age_seconds: null, rules_count: 0 }
  return {
    cached:       isCacheValid(),
    source:       _rulesCache.source,
    age_seconds:  Math.round((Date.now() - _rulesCache.loaded_at) / 1000),
    rules_count:  _rulesCache.rules.length,
  }
}

/**
 * DB-aware version of runDeterministicRules.
 * Loads rules from cache/DB/fallback transparently.
 */
async function runDeterministicRulesWithCache(
  contenido: string,
  producto: string
): Promise<{ issues: ComplianceIssue[]; rules_source: 'db' | 'fallback' }> {
  const { rules, source } = await getActiveRules()

  const lowerContent = contenido.toLowerCase()
  const issues: ComplianceIssue[] = []

  for (const rule of rules) {
    if (rule.products && rule.products.length > 0 && !rule.products.includes(producto)) continue

    let matched = false
    let matchedText = ''

    if (typeof rule.pattern === 'string') {
      if (lowerContent.includes(rule.pattern.toLowerCase())) {
        matched = true
        matchedText = rule.pattern
      }
    } else {
      const match = contenido.match(rule.pattern)
      if (match) { matched = true; matchedText = match[0] }
    }

    if (matched) {
      issues.push({
        category:             rule.category,
        rule_id:              rule.rule_id,
        risk_level:           rule.severity,
        problematic_text:     matchedText,
        explanation:          rule.description,
        recommended_revision: rule.recommendation,
        source:               'deterministic',
      })
    }
  }

  return { issues, rules_source: source }
}
