import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildCopilotContext } from '@/lib/growth-engine/context-builder'
import type { ObjecionAnalisis } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `Eres un experto en comunicación ética y profesional para agentes de seguros hispanos en Estados Unidos.

Tu especialidad es ayudar a los agentes a entender y responder objeciones de manera honesta, empática y efectiva.

PRINCIPIOS FUNDAMENTALES — NO NEGOCIABLES:
1. NUNCA sugieras técnicas manipulativas, de alta presión, urgencia falsa, o culpa implícita.
2. Tu objetivo es DESCUBRIR NECESIDADES REALES, no "vencer" al prospecto.
3. Una objeción frecuentemente esconde una preocupación legítima que merece respuesta honesta.
4. Si el producto genuinamente no es adecuado para el prospecto, es válido y ético decirlo.
5. La confianza a largo plazo vale más que cualquier venta forzada.
6. Respeta siempre la autonomía del prospecto para tomar decisiones informadas.

COMPLIANCE POR PRODUCTO:
- Medicare: nunca prometer cobertura específica sin calificación. "Puede cubrir" ✓ | "Va a cubrir" ✗
- ACA: los subsidios dependen de ingresos reportados — no garantizar montos específicos.
- IUL: nunca garantizar rendimientos del índice. "Potencial de crecimiento vinculado al índice" ✓
- Gastos finales: cubre gastos funerarios dentro del monto aprobado — no "todo" ni "todos los gastos".
- Vida: el beneficio es por fallecimiento — no confundir con ahorro o cuenta de retiro.

LOS 5 ÁNGULOS DE RESPUESTA:
- empatico: primero valida el sentimiento, luego explora sin presionar
- educativo: explica el contexto real o el valor sin empujar a una decisión
- descubrimiento: hace preguntas abiertas para entender la raíz real de la objeción
- historia: comparte experiencia de otro cliente similar SIN inventar datos (usa "He tenido clientes que...")
- acuerdo: acepta la objeción como válida y redirige hacia la necesidad real del prospecto

IMPORTANTE SOBRE HISTORIAS: Nunca atribuyas experiencias al agente que no conoces. Usa siempre frases como "He tenido familias que..." o "Un cliente cubano de 68 años me dijo algo parecido..." — nunca datos específicos inventados.

ESTRUCTURA DE RESPUESTA — DEVUELVE ÚNICAMENTE JSON VÁLIDO:
{
  "significado_real": "Qué puede estar comunicando realmente el prospecto",
  "tipo": "precio|tiempo|confianza|necesidad|autoridad|otro",
  "nivel_resistencia": "baja|media|alta",
  "estrategia_recomendada": "El enfoque de comunicación más apropiado para esta situación concreta",
  "respuestas": [
    {
      "angulo": "empatico",
      "etiqueta": "Empático",
      "texto_whatsapp": "Versión con markdown de WhatsApp (*negrita*, _cursiva_) — lista para copiar y pegar",
      "texto_verbal": "Versión natural para decir en persona o por llamada — sin markdown",
      "cuando_usar": "En qué contexto funciona mejor esta respuesta"
    },
    { "angulo": "educativo", "etiqueta": "Educativo", ... },
    { "angulo": "descubrimiento", "etiqueta": "Descubrimiento", ... },
    { "angulo": "historia", "etiqueta": "Historia real", ... },
    { "angulo": "acuerdo", "etiqueta": "Acuerdo + redirección", ... }
  ],
  "pregunta_seguimiento": "Una pregunta abierta que invita al prospecto a compartir más sin presionarlo",
  "que_evitar": ["Frase o técnica específica a NO usar", "Otra cosa concreta a evitar"],
  "compliance_nota": "Nota de compliance si el producto lo requiere, o null si no aplica"
}

Las respuestas deben sonar exactamente como el agente específico — con su tono, sus frases características y su mercado.
NO incluyas texto fuera del JSON.`

const complianceByProduct: Record<string, string> = {
  medicare: 'COMPLIANCE: No prometer cobertura específica sin calificación previa.',
  aca: 'COMPLIANCE: Los subsidios dependen de ingresos — no garantizar montos específicos.',
  iul: 'COMPLIANCE: No garantizar rendimientos del índice de ninguna manera.',
  final_expense: 'COMPLIANCE: El seguro cubre gastos funerarios hasta el monto aprobado, no "todo".',
  life: 'COMPLIANCE: Es un seguro de vida (beneficio por fallecimiento) — no una cuenta de ahorro.',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

  const body = await request.json() as {
    objecion: string
    producto?: string
    canal?: string
    contexto?: string
  }

  if (!body.objecion?.trim()) {
    return new Response(JSON.stringify({ error: 'La objeción es requerida' }), { status: 400 })
  }

  // Check usage limit
  const period = new Date().toISOString().slice(0, 7) + '-01'
  const { count } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('modulo', 'objection_ai')
    .eq('periodo_mes', period)

  const { data: profileData } = await supabase
    .from('profiles').select('plan_tier').eq('id', user.id).single()
  const plan = (profileData as { plan_tier?: string } | null)?.plan_tier ?? 'starter'
  const limits: Record<string, number> = { elite: -1, pro: 60, starter: 15 }
  const maxLimit = limits[plan] ?? 15
  const used = count ?? 0

  if (maxLimit !== -1 && used >= maxLimit) {
    return new Response(
      JSON.stringify({ error: `Límite de Objection AI alcanzado (${used}/${maxLimit}). Actualiza tu plan.` }),
      { status: 429 }
    )
  }

  // Build agent context (includes intel profile + cliente ideal)
  const { formatted: agentContext } = await buildCopilotContext(user.id, {
    includeHistory: false,
    daysHistory: 7,
  })

  const { data: intelData } = await supabase
    .from('agent_intelligence_profiles')
    .select('objeciones_frecuentes, cliente_ideal_json, tono_comunicacion')
    .eq('user_id', user.id)
    .single()

  const intel = intelData as Record<string, unknown> | null
  const complianceNote = complianceByProduct[body.producto ?? ''] ?? ''

  const userMessage = [
    '=== CONTEXTO DEL AGENTE ===',
    agentContext,
    '',
    intel?.objeciones_frecuentes
      ? `=== OBJECIONES FRECUENTES REGISTRADAS ===\n${JSON.stringify(intel.objeciones_frecuentes)}`
      : '',
    '',
    '=== OBJECIÓN A ANALIZAR ===',
    `Objeción del prospecto: "${body.objecion}"`,
    body.producto ? `Producto en conversación: ${body.producto}` : '',
    body.canal ? `Canal de comunicación: ${body.canal}` : '',
    body.contexto ? `Contexto adicional del prospecto: ${body.contexto}` : '',
    complianceNote ? `\n${complianceNote}` : '',
    '',
    'Genera el análisis completo con los 5 ángulos de respuesta.',
    'Las respuestas deben sonar exactamente como este agente específico.',
    'DEVUELVE ÚNICAMENTE JSON VÁLIDO — sin texto antes ni después.',
  ].filter(Boolean).join('\n')

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            )
          }
        }

        // Parse analysis
        let analisis: ObjecionAnalisis | null = null
        try {
          const clean = fullText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
          analisis = JSON.parse(clean) as ObjecionAnalisis
        } catch {
          // Auto-fix attempt
          try {
            const fix = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 2000,
              system: 'Corrige este JSON malformado. Devuelve SOLO el JSON válido sin texto adicional.',
              messages: [{ role: 'user', content: `JSON a corregir:\n${fullText}` }],
            })
            const fixText = fix.content[0]?.type === 'text' ? fix.content[0].text : ''
            analisis = JSON.parse(fixText) as ObjecionAnalisis
          } catch { /* fails silently */ }
        }

        // Log usage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('ai_usage').insert({
          user_id: user.id,
          modulo: 'objection_ai',
          operacion: 'objection_analyze',
          tokens_total: 0,
          costo_usd: 0,
          fue_cacheado: false,
          periodo_mes: period,
        })

        // Save to DB for learning signals
        let savedId: string | null = null
        if (analisis) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: saved } = await (supabase as any)
            .from('objection_responses')
            .insert({
              user_id: user.id,
              objecion_texto: body.objecion,
              objecion_tipo: analisis.tipo,
              producto: body.producto ?? null,
              canal: body.canal ?? null,
              contexto_prospecto: body.contexto ?? null,
              respuesta_json: analisis,
            })
            .select('id')
            .single()
          savedId = (saved as { id: string } | null)?.id ?? null
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            done: true,
            analisis,
            response_id: savedId,
            json_failed: !analisis,
          })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inesperado'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
