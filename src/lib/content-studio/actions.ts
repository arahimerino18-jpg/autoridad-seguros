'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'
import type { ContentOutput } from '@/lib/content-studio/channel-registry'

export interface SaveContentParams {
  channelId: string
  producto: string
  objetivo: string
  tema: string
  output: ContentOutput
  compliance_nivel?: 'verde' | 'amarillo' | 'rojo'
  growth_output_id?: string
  contenido_origen_id?: string
  instruccion_extra?: string
}

export async function saveContentAction(
  params: SaveContentParams
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  const { tipo, plataforma } = mapChannelToDb(params.channelId)
  const cuerpo = extractBodyText(params.output)
  // Use unknown cast to avoid ContentOutput → Record inference issue
  const outputObj = params.output as unknown as Record<string, unknown>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('contenidos') as any).insert({
    user_id: user.id,
    tipo,
    plataforma,
    producto: params.producto,
    objetivo: params.objetivo,
    titulo: params.tema.slice(0, 100),
    cuerpo,
    status: 'draft',
    compliance_revisado: !!params.compliance_nivel,
    tono_generacion: null,
    instruccion_extra: params.instruccion_extra ?? null,
    // Phase 7: store full structured output for library preview replay
    output_json: params.output as unknown as Record<string, unknown>,
    slides_json: 'slides' in outputObj ? outputObj.slides : null,
    segmentos_json: 'segmentos' in outputObj ? outputObj.segmentos : null,
  }).select('id').single()

  if (error) return { success: false, error: 'Error al guardar el contenido.' }

  const saved = data as { id: string }

  if (params.growth_output_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('growth_engine_outputs') as any)
      .update({ fue_ejecutada: true, contenido_generado_id: saved.id })
      .eq('id', params.growth_output_id)
      .eq('user_id', user.id)
  }

  revalidatePath('/content-studio')
  revalidatePath('/dashboard')
  return { success: true, data: { id: saved.id } }
}

export async function adaptContentAction(
  contenidoId: string,
  // targetChannelId reserved for Phase 9 series linking
  _targetChannelId?: string
): Promise<ActionResult<{ tema: string; producto: string; objetivo: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('contenidos') as any)
    .select('titulo, producto, objetivo, cuerpo, growth_output_id')
    .eq('id', contenidoId)
    .eq('user_id', user.id)
    .single()

  if (!data) return { success: false, error: 'Contenido no encontrado.' }

  const source = data as { titulo: string; producto: string; objetivo: string }

  return {
    success: true,
    data: { tema: source.titulo, producto: source.producto, objetivo: source.objetivo },
  }
}

export async function markContentPublishedAction(
  contenidoId: string,
  canal?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('contenidos') as any)
    .update({
      fue_publicado: true,
      fecha_publicado: new Date().toISOString(),
      canal_publicacion: canal ?? null,
    })
    .eq('id', contenidoId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Error al actualizar.' }

  revalidatePath('/contenidos')
  return { success: true, data: undefined }
}

export async function deleteContentAction(contenidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sesión expirada.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('contenidos') as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contenidoId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Error al eliminar.' }
  revalidatePath('/content-studio')
  return { success: true, data: undefined }
}

function mapChannelToDb(channelId: string): { tipo: string; plataforma: string } {
  const map: Record<string, { tipo: string; plataforma: string }> = {
    instagram_post: { tipo: 'post', plataforma: 'instagram' },
    facebook_post: { tipo: 'post', plataforma: 'facebook' },
    linkedin_post: { tipo: 'post', plataforma: 'linkedin' },
    nextdoor_post: { tipo: 'post', plataforma: 'instagram' },
    carousel: { tipo: 'carousel', plataforma: 'instagram' },
    story: { tipo: 'story', plataforma: 'instagram' },
    reel_script: { tipo: 'reel', plataforma: 'instagram' },
    tiktok_script: { tipo: 'reel', plataforma: 'tiktok' },
    whatsapp: { tipo: 'whatsapp', plataforma: 'whatsapp' },
    email_marketing: { tipo: 'email', plataforma: 'instagram' },
    sms: { tipo: 'sms', plataforma: 'instagram' },
  }
  return map[channelId] ?? { tipo: 'post', plataforma: 'instagram' }
}

function extractBodyText(output: ContentOutput): string {
  const o = output as unknown as Record<string, unknown>
  if (typeof o.caption === 'string') return o.caption
  if (typeof o.cuerpo === 'string') return o.cuerpo
  if (typeof o.version_larga === 'string') return o.version_larga
  if (typeof o.mensaje === 'string') return o.mensaje
  return JSON.stringify(output).slice(0, 2000)
}
