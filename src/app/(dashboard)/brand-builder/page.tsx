import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrandBuilder } from '@/components/brand-builder/brand-builder'

export const metadata: Metadata = {
  title: 'Centro de Identidad | Autoridad Seguros AI™',
}

export default async function BrandBuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load all data needed for the Brand Builder
  const [profileRes, brandKitRes, intelRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('brand_kits').select('*').eq('user_id', user.id).single(),
    supabase.from('agent_intelligence_profiles').select('*').eq('user_id', user.id).single(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const brandKit = (brandKitRes.data ?? {}) as Record<string, unknown>
  const intel = (intelRes.data ?? {}) as Record<string, unknown>

  // Get or create active interview session
  let sessionId: string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingSession } = await (supabase.from('interview_sessions') as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('es_activa', true)
    .eq('status', 'en_progreso')
    .single()

  if (existingSession?.id) {
    sessionId = existingSession.id as string
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newSession } = await (supabase.from('interview_sessions') as any)
      .insert({
        user_id: user.id,
        status: 'en_progreso',
        conversacion: [],
        temas_cubiertos: [],
        score_covertura: 0,
        es_activa: true,
      })
      .select('id')
      .single()

    sessionId = (newSession as Record<string, unknown>)?.id as string ?? 'temp'
  }

  // Build the combined data object for the Brand Builder
  const brandBuilderData = {
    // From profiles
    nombre_completo: (profile.nombre_completo as string) ?? '',
    especialidades: (profile.especialidades as string[]) ?? [],
    // From brand_kits
    nombre_comercial: (brandKit.nombre_comercial as string | null) ?? null,
    nombre_agencia: (brandKit.nombre_agencia as string | null) ?? null,
    anos_experiencia: (brandKit.anos_experiencia as number | null) ?? null,
    certificaciones: (brandKit.certificaciones as string[] | null) ?? null,
    estados_licencia: (brandKit.estados_licencia as string[] | null) ?? null,
    numero_licencia: (brandKit.numero_licencia as string | null) ?? null,
    color_primario: (brandKit.color_primario as string) ?? '#1B2E6B',
    color_secundario: (brandKit.color_secundario as string) ?? '#D4A017',
    color_acento: (brandKit.color_acento as string | null) ?? null,
    tipografia_principal: (brandKit.tipografia_principal as string | null) ?? null,
    tipografia_secundaria: (brandKit.tipografia_secundaria as string | null) ?? null,
    estilo_grafico: (brandKit.estilo_grafico as string | null) ?? null,
    estilo_fotografico: (brandKit.estilo_fotografico as string | null) ?? null,
    tagline: (brandKit.tagline as string | null) ?? null,
    logo_url: (brandKit.logo_url as string | null) ?? null,
    logo_variante_blanca_url: (brandKit.logo_variante_blanca_url as string | null) ?? null,
    logo_icono_url: (brandKit.logo_icono_url as string | null) ?? null,
    instagram_handle: (brandKit.instagram_handle as string | null) ?? null,
    facebook_url: (brandKit.facebook_url as string | null) ?? null,
    tiktok_handle: (brandKit.tiktok_handle as string | null) ?? null,
    linkedin_url: (brandKit.linkedin_url as string | null) ?? null,
    youtube_url: (brandKit.youtube_url as string | null) ?? null,
    pinterest_url: (brandKit.pinterest_url as string | null) ?? null,
    whatsapp_business: (brandKit.whatsapp_business as string | null) ?? null,
    calendly_url: (brandKit.calendly_url as string | null) ?? null,
    sitio_web: (brandKit.sitio_web as string | null) ?? null,
    // From agent_intelligence_profiles
    tono_comunicacion: (intel.tono_comunicacion as string | null) ?? null,
    nivel_formalidad: (intel.nivel_formalidad as number | null) ?? null,
    estilo_escritura: (intel.estilo_escritura as string | null) ?? null,
    tipo_humor: (intel.tipo_humor as string | null) ?? null,
    nivel_emocional: (intel.nivel_emocional as string | null) ?? null,
    usa_emojis: (intel.usa_emojis as boolean) ?? true,
    usa_historias: (intel.usa_historias as boolean) ?? true,
    usa_estadisticas: (intel.usa_estadisticas as boolean) ?? false,
    frases_propias: (intel.frases_propias as string[] | null) ?? null,
    palabras_a_evitar: (intel.palabras_a_evitar as string[] | null) ?? null,
    ctas_efectivos: (intel.ctas_efectivos as string[] | null) ?? null,
    propuesta_de_valor: (intel.propuesta_de_valor as string | null) ?? null,
    diferenciadores: (intel.diferenciadores as string[] | null) ?? null,
    longitud_preferida: (intel.longitud_preferida as string | null) ?? null,
    historia_profesional: (intel.historia_profesional as string | null) ?? null,
    historia_personal: (intel.historia_personal as string | null) ?? null,
    mision: (intel.mision as string | null) ?? null,
    vision: (intel.vision as string | null) ?? null,
    valores: (intel.valores as string[] | null) ?? null,
    mercado_objetivo: (intel.mercado_objetivo as string | null) ?? null,
    cliente_ideal_descripcion: (intel.cliente_ideal_descripcion as string | null) ?? null,
    nichos_secundarios: (intel.nichos_secundarios as string[] | null) ?? null,
    productos_principales: (intel.productos_principales as string[] | null) ?? null,
    problemas_que_resuelve: (intel.problemas_que_resuelve as string[] | null) ?? null,
    objeciones_frecuentes: (intel.objeciones_frecuentes as Array<{ objecion: string; respuesta: string; categoria: string }> | null) ?? null,
    metas_negocio: (intel.metas_negocio as { corto_plazo: string; largo_plazo: string } | null) ?? null,
    fuente_leads_principal: (intel.fuente_leads_principal as string | null) ?? null,
    tasa_cierre_estimada: (intel.tasa_cierre_estimada as number | null) ?? null,
    score_perfil_completitud: (intel.score_perfil_completitud as number) ?? 0,
    entrevista_completada: (intel.entrevista_completada as boolean) ?? false,
    idiomas: (intel.idiomas as string[]) ?? ['Español'],
  }

  return <BrandBuilder data={brandBuilderData} sessionId={sessionId} userId={user.id} intelData={intel as Record<string, unknown>} />
}
