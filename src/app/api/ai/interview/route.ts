import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Interview system prompt ──────────────────────────────────────────────────

const INTERVIEW_SYSTEM_PROMPT = `Eres "Marco", un consultor experto en marca personal para agentes de seguros hispanos en Estados Unidos. 
Tienes 20 años de experiencia ayudando a agentes a construir su identidad profesional y su presencia digital.

Tu objetivo es conocer profundamente a este agente de seguros mediante una conversación natural y cálida.
No suenas a formulario. Suenas a consultor experto que hace preguntas inteligentes.

TEMAS QUE NECESITAS CUBRIR (no en orden fijo — adapta según las respuestas):
1. historia_personal — Cómo llegaron a seguros, qué los motivó
2. motivacion_profunda — Qué los mueve emocionalmente en este trabajo
3. mercado_objetivo — A quién ayudan principalmente
4. productos_principales — Con qué productos trabajan más
5. diferenciadores — Por qué elegiría a este agente y no a otro
6. estilo_comunicacion — Formal o cercano, emocional o lógico
7. valores — Principios que guían su trabajo
8. cliente_ideal — El cliente perfecto con quien siempre quieren trabajar
9. objeciones_frecuentes — Las dudas más comunes que escuchan
10. frases_propias — Expresiones características que usan
11. ctas_efectivos — Qué le piden a la gente que haga después de hablar
12. mision_profesional — El impacto que quieren tener en su comunidad
13. vision_negocio — Cómo se ven en 3-5 años

REGLAS DE CONVERSACIÓN:
- Haz UNA sola pregunta por turno. Nunca dos preguntas juntas.
- Si la respuesta es rica y detallada → profundiza con una pregunta de seguimiento específica
- Si la respuesta es corta → pasa al siguiente tema con una pregunta diferente
- Usa el nombre del agente si lo conoces
- Conecta las preguntas entre sí ("Mencionaste que... eso me lleva a preguntarte...")
- Celebra respuestas honestas y detalladas con frases cortas ("Eso es muy poderoso.", "Excelente.")
- Nunca repitas temas ya cubiertos a fondo
- Cuando hayas cubierto al menos 8 temas con buenas respuestas, puedes terminar la conversación

FORMATO DE RESPUESTA:
Cada respuesta tuya DEBE incluir al final este bloque JSON oculto (el frontend lo parsea y lo oculta):
<!--METADATA:{"temas_cubiertos":["tema1","tema2"],"listo_para_resumir":false,"extractos":{"tema":"texto"}}-->

El campo "listo_para_resumir" debe ser true cuando hayas cubierto al menos 8 temas con respuestas sustanciales.

INICIO DE ENTREVISTA:
Cuando el historial esté vacío (es la primera pregunta), preséntate brevemente y haz la primera pregunta.
Primera pregunta siempre: la historia de cómo llegó a trabajar en seguros.`

// ─── Summary generation prompt ────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `Eres un experto en marca personal para agentes de seguros hispanos.
Basándote en la conversación de entrevista, genera:

1. Un perfil narrativo en español (2-3 párrafos) que describa a este agente de manera auténtica y profesional.
   Este texto será visible al agente para que lo apruebe o edite.

2. Un JSON estructurado con todos los datos extraídos de la conversación.

FORMATO DE RESPUESTA (usa exactamente este formato):

===RESUMEN_VISIBLE===
[Escribe aquí el perfil narrativo en 2-3 párrafos. Cálido, profesional, en primera persona del agente.]
===FIN_RESUMEN===

===DATOS_JSON===
{
  "tono_comunicacion": "...",
  "nivel_formalidad": 2,
  "estilo_escritura": "conversacional",
  "tipo_humor": "ligero",
  "nivel_emocional": "equilibrado",
  "usa_emojis": true,
  "usa_historias": true,
  "frases_propias": ["...", "..."],
  "palabras_a_evitar": [],
  "propuesta_de_valor": "...",
  "historia_personal": "...",
  "historia_profesional": "...",
  "mision": "...",
  "vision": "...",
  "valores": ["...", "..."],
  "diferenciadores": ["...", "..."],
  "mercado_objetivo": "...",
  "cliente_ideal_descripcion": "...",
  "productos_principales": ["medicare"],
  "problemas_que_resuelve": ["...", "..."],
  "objeciones_frecuentes": [{"objecion": "...", "respuesta": "...", "categoria": "precio"}],
  "ctas_efectivos": ["...", "..."]
}
===FIN_DATOS===`

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface InterviewMetadata {
  temas_cubiertos: string[]
  listo_para_resumir: boolean
  extractos: Record<string, string>
}

// ─── POST /api/ai/interview ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as {
    action: 'message' | 'summary'
    conversacion: Message[]
    session_id?: string
  }

  const { action, conversacion, session_id } = body

  if (action === 'message') {
    return handleMessage(conversacion, session_id, user.id)
  }

  if (action === 'summary') {
    return handleSummary(conversacion, session_id, user.id)
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}

// ─── Handle message turn ──────────────────────────────────────────────────────

async function handleMessage(
  conversacion: Message[],
  sessionId: string | undefined,
  userId: string
) {
  // Get agent's basic profile for personalization
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre_completo, especialidades')
    .eq('id', userId)
    .single()

  const agentName = (profile as Record<string, unknown> | null)?.nombre_completo as string | null

  // Build messages for Claude
  const messages = conversacion.map((m) => ({
    role: m.role as 'user' | 'assistant',
    // Strip metadata from assistant messages before sending back to Claude
    content: m.content.replace(/<!--METADATA:.*?-->/s, '').trim(),
  }))

  // If first message, inject context about the agent
  const systemWithContext = agentName
    ? `${INTERVIEW_SYSTEM_PROMPT}\n\nCONTEXTO DEL AGENTE:\nNombre: ${agentName}`
    : INTERVIEW_SYSTEM_PROMPT

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: systemWithContext,
          messages,
        })

        for await (const chunk of claudeStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullText += text
            // Stream only the visible text (not metadata block)
            const visibleText = text.replace(/<!--METADATA:.*?-->/s, '')
            if (visibleText) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: visibleText })}\n\n`)
              )
            }
          }
        }

        // Extract and send metadata separately
        const metadataMatch = fullText.match(/<!--METADATA:(.*?)-->/s)
        let metadata: InterviewMetadata = {
          temas_cubiertos: [],
          listo_para_resumir: false,
          extractos: {},
        }

        if (metadataMatch) {
          try {
            metadata = JSON.parse(metadataMatch[1]) as InterviewMetadata
          } catch {
            // Metadata parse failed — use defaults
          }
        }

        // Send metadata event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ metadata, done: true })}\n\n`
          )
        )

        // Update session in DB if we have a session_id
        if (sessionId) {
          const supabase = await createClient()
          const newMessage = {
            role: 'assistant',
            content: fullText,
            timestamp: new Date().toISOString(),
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('interview_sessions') as any)
            .update({
              temas_cubiertos: metadata.temas_cubiertos,
              conversacion: [...conversacion, newMessage],
            })
            .eq('id', sessionId)
            .eq('user_id', userId)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        )
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

// ─── Handle summary generation ────────────────────────────────────────────────

async function handleSummary(
  conversacion: Message[],
  sessionId: string | undefined,
  userId: string
) {
  const encoder = new TextEncoder()

  // Build conversation transcript for summary
  const transcript = conversacion
    .map((m) => {
      const cleanContent = m.content.replace(/<!--METADATA:.*?-->/s, '').trim()
      return `${m.role === 'assistant' ? 'Marco (Consultor)' : 'Agente'}: ${cleanContent}`
    })
    .join('\n\n')

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SUMMARY_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Por favor genera el perfil basándote en esta entrevista:\n\n${transcript}`,
            },
          ],
        })

        for await (const chunk of claudeStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullText += chunk.delta.text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            )
          }
        }

        // Parse the structured response
        const resumeMatch = fullText.match(/===RESUMEN_VISIBLE===\n([\s\S]*?)\n===FIN_RESUMEN===/)
        const dataMatch = fullText.match(/===DATOS_JSON===\n([\s\S]*?)\n===FIN_DATOS===/)

        const resumenVisible = resumeMatch ? resumeMatch[1].trim() : ''
        let datosEstructurados: Record<string, unknown> = {}

        if (dataMatch) {
          try {
            datosEstructurados = JSON.parse(dataMatch[1]) as Record<string, unknown>
          } catch {
            // JSON parse failed — keep empty
          }
        }

        // Save summary to session
        if (sessionId) {
          const supabase = await createClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('interview_sessions') as any)
            .update({
              status: 'resumen_generado',
              resumen_visible: resumenVisible,
              datos_estructurados: datosEstructurados,
            })
            .eq('id', sessionId)
            .eq('user_id', userId)
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              resumen_visible: resumenVisible,
              datos_estructurados: datosEstructurados,
            })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al generar resumen'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        )
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
