'use client'

/**
 * Brand Builder Tabs: Marca Personal, Público Objetivo, Visual, Redes
 * Each tab saves independently to both brand_kits and agent_intelligence_profiles.
 */

import { useState } from 'react'
import { Input, Textarea, Button, Alert } from '@/components/ui'
import { cn, isValidHexColor } from '@/lib/utils'
import {
  saveMarcaPersonalAction,
  savePublicoObjetivoAction,
  saveIdentidadVisualAction,
  saveRedesSocialesAction,
} from '@/lib/brand-builder/actions'
import type { BrandBuilderData } from './brand-builder'
import { useToast } from '@/hooks/use-toast'

// ─── Shared inline tag input ──────────────────────────────────────────────────

function TagInput({
  label,
  helperText,
  tags,
  placeholder,
  onChange,
}: {
  label: string
  helperText?: string
  tags: string[]
  placeholder: string
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-navy-50 text-brand-navy-700 text-xs font-medium rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-brand-navy-400 hover:text-brand-navy-700"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag() }
          }}
          placeholder={placeholder}
          className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!input.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-brand-navy-500 text-white rounded-lg hover:bg-brand-navy-600 disabled:opacity-40"
        >
          + Agregar
        </button>
      </div>
      {helperText && <p className="text-xs text-gray-400 mt-1">{helperText}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MARCA PERSONAL
// ═══════════════════════════════════════════════════════════════════════════════

export function TabMarcaPersonal({
  data,
  onUpdate,
}: {
  data: BrandBuilderData
  onUpdate: (u: Partial<BrandBuilderData>) => void
}) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    tono_comunicacion: data.tono_comunicacion ?? '',
    nivel_formalidad: data.nivel_formalidad ?? 2,
    estilo_escritura: data.estilo_escritura ?? '',
    tipo_humor: data.tipo_humor ?? 'ninguno',
    nivel_emocional: data.nivel_emocional ?? 'equilibrado',
    usa_emojis: data.usa_emojis,
    usa_historias: data.usa_historias,
    longitud_preferida: data.longitud_preferida ?? 'medio',
    propuesta_de_valor: data.propuesta_de_valor ?? '',
    frases_propias: data.frases_propias ?? [],
    palabras_a_evitar: data.palabras_a_evitar ?? [],
    ctas_efectivos: data.ctas_efectivos ?? [],
    diferenciadores: data.diferenciadores ?? [],
  })

  const handleSave = async () => {
    setIsSaving(true); setError(null)
    const result = await saveMarcaPersonalAction(form)
    if (result.success) {
      toast.success('Guardado', 'Marca personal actualizada.')
      onUpdate(form)
    } else { setError(result.error) }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Tono y estilo <span className="text-brand-gold-500 font-normal text-xs ml-1">+16% al perfil de IA</span></h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tono de comunicación</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Cálido y cercano', 'Profesional', 'Educativo', 'Inspirador', 'Directo', 'Empático', 'Conversacional', 'Formal'].map((tono) => (
              <button key={tono} type="button" onClick={() => setForm(p => ({ ...p, tono_comunicacion: tono }))}
                className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left', form.tono_comunicacion === tono ? 'bg-brand-navy-500 text-white border-brand-navy-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
                {tono}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nivel de formalidad: {form.nivel_formalidad}/5</label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Muy informal</span>
            <input type="range" min={1} max={5} value={form.nivel_formalidad}
              onChange={(e) => setForm(p => ({ ...p, nivel_formalidad: parseInt(e.target.value) }))}
              className="flex-1 accent-brand-navy-500" />
            <span className="text-xs text-gray-400">Muy formal</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'usa_emojis', label: '😊 Usa emojis' },
            { key: 'usa_historias', label: '📖 Usa historias' },
          ].map(({ key, label }) => (
            <label key={key} className={cn('flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all',
              form[key as 'usa_emojis' | 'usa_historias'] ? 'bg-brand-navy-50 border-brand-navy-300' : 'bg-white border-gray-200 hover:border-gray-300')}>
              <input type="checkbox" checked={form[key as 'usa_emojis' | 'usa_historias']}
                onChange={(e) => setForm(p => ({ ...p, [key]: e.target.checked }))}
                className="accent-brand-navy-500" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Longitud preferida</label>
            <select value={form.longitud_preferida}
              onChange={(e) => setForm(p => ({ ...p, longitud_preferida: e.target.value }))}
              className="w-full h-9 px-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500">
              <option value="corto">Corto (menos de 100 palabras)</option>
              <option value="medio">Medio (100-200 palabras)</option>
              <option value="largo">Largo (200+ palabras)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Propuesta de valor <span className="text-brand-gold-500 font-normal text-xs ml-1">+8% al perfil de IA</span></h3>
        <Textarea label="¿Qué hace único tu servicio?" value={form.propuesta_de_valor}
          onChange={(e) => setForm(p => ({ ...p, propuesta_de_valor: e.target.value }))}
          rows={3} placeholder="Ej: Soy la única agente en Miami que acompaña a mis clientes cubanos desde la selección del plan hasta la primera cita médica, en español, sin presión..." characterCount maxLength={500}
          helperText="En tus propias palabras, no lenguaje corporativo" />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Tu voz única</h3>
        <TagInput label="Frases características" helperText="Expresiones que siempre usas con clientes" tags={form.frases_propias}
          placeholder="Ej: Tu salud es tu mayor inversión" onChange={(tags) => setForm(p => ({ ...p, frases_propias: tags }))} />
        <TagInput label="Palabras que NUNCA debes usar" helperText="Términos que confunden o alejan a tu cliente" tags={form.palabras_a_evitar}
          placeholder="Ej: copago, deducible, cobertura catastrófica" onChange={(tags) => setForm(p => ({ ...p, palabras_a_evitar: tags }))} />
        <TagInput label="CTAs efectivos" helperText="Llamadas a la acción que funcionan para ti" tags={form.ctas_efectivos}
          placeholder="Ej: Escríbeme MEDICARE en los comentarios" onChange={(tags) => setForm(p => ({ ...p, ctas_efectivos: tags }))} />
        <TagInput label="Tus diferenciadores" helperText="Lo que te hace único frente a otros agentes" tags={form.diferenciadores}
          placeholder="Ej: Hablo 3 idiomas" onChange={(tags) => setForm(p => ({ ...p, diferenciadores: tags }))} />
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">Guardar marca personal</Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PÚBLICO OBJETIVO
// ═══════════════════════════════════════════════════════════════════════════════

export function TabPublico({
  data,
  onUpdate,
}: {
  data: BrandBuilderData
  onUpdate: (u: Partial<BrandBuilderData>) => void
}) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    mercado_objetivo: data.mercado_objetivo ?? '',
    cliente_ideal_descripcion: data.cliente_ideal_descripcion ?? '',
    nichos_secundarios: data.nichos_secundarios ?? [],
    problemas_que_resuelve: data.problemas_que_resuelve ?? [],
    objeciones_texto: data.objeciones_frecuentes?.map(o => o.objecion).join('\n') ?? '',
    metas_corto: data.metas_negocio?.corto_plazo ?? '',
    metas_largo: data.metas_negocio?.largo_plazo ?? '',
    fuente_leads: data.fuente_leads_principal ?? '',
    tasa_cierre: data.tasa_cierre_estimada?.toString() ?? '',
  })

  const handleSave = async () => {
    setIsSaving(true); setError(null)
    const objeciones = form.objeciones_texto
      .split('\n').filter(Boolean)
      .map(o => ({ objecion: o.trim(), respuesta: '', categoria: 'general' }))

    const result = await savePublicoObjetivoAction({
      mercado_objetivo: form.mercado_objetivo || undefined,
      cliente_ideal_descripcion: form.cliente_ideal_descripcion || undefined,
      nichos_secundarios: form.nichos_secundarios.length ? form.nichos_secundarios : undefined,
      problemas_que_resuelve: form.problemas_que_resuelve.length ? form.problemas_que_resuelve : undefined,
      objeciones_frecuentes: objeciones.length ? objeciones : undefined,
      metas_negocio: (form.metas_corto || form.metas_largo)
        ? { corto_plazo: form.metas_corto, largo_plazo: form.metas_largo }
        : undefined,
      fuente_leads_principal: form.fuente_leads || undefined,
      tasa_cierre_estimada: form.tasa_cierre ? parseInt(form.tasa_cierre) : undefined,
    })
    if (result.success) {
      toast.success('Guardado', 'Público objetivo actualizado.')
      onUpdate({ mercado_objetivo: form.mercado_objetivo || null })
    } else { setError(result.error) }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Tu mercado <span className="text-brand-gold-500 font-normal text-xs ml-1">+16% al perfil de IA</span></h3>
        <Input label="Mercado objetivo principal" value={form.mercado_objetivo}
          onChange={(e) => setForm(p => ({ ...p, mercado_objetivo: e.target.value }))}
          placeholder="Ej: Familias cubanas y venezolanas 55-75 años en Miami" />
        <Textarea label="Descripción del cliente ideal" value={form.cliente_ideal_descripcion}
          onChange={(e) => setForm(p => ({ ...p, cliente_ideal_descripcion: e.target.value }))}
          rows={3} placeholder="¿Quién es tu cliente perfecto? Edad, origen, situación, necesidades, miedos..." characterCount maxLength={500} />
        <TagInput label="Nichos secundarios" tags={form.nichos_secundarios}
          placeholder="Ej: Empleados de pequeñas empresas" onChange={(tags) => setForm(p => ({ ...p, nichos_secundarios: tags }))} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Objeciones frecuentes <span className="text-brand-gold-500 font-normal text-xs ml-1">+15% al perfil de IA</span></h3>
        <Textarea label="Una objeción por línea" value={form.objeciones_texto}
          onChange={(e) => setForm(p => ({ ...p, objeciones_texto: e.target.value }))}
          rows={5} placeholder={"Eso es muy caro\nYa tengo seguro con mi trabajo\nTengo que consultarlo con mi esposo\nNo confío en los seguros"} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Metas y métricas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Textarea label="Meta a corto plazo (este año)" value={form.metas_corto}
            onChange={(e) => setForm(p => ({ ...p, metas_corto: e.target.value }))} rows={2}
            placeholder="Ej: Llegar a 200 clientes activos, obtener la certificación AHIP..." />
          <Textarea label="Meta a largo plazo (3-5 años)" value={form.metas_largo}
            onChange={(e) => setForm(p => ({ ...p, metas_largo: e.target.value }))} rows={2}
            placeholder="Ej: Construir una agencia de 5 agentes, expandir a 3 estados..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Principal fuente de leads</label>
            <select value={form.fuente_leads} onChange={(e) => setForm(p => ({ ...p, fuente_leads: e.target.value }))}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500">
              <option value="">Selecciona...</option>
              {['Instagram', 'Facebook', 'Referidos', 'WhatsApp', 'Google', 'TikTok', 'LinkedIn', 'Eventos', 'Puerta a puerta', 'Telemarketing'].map(f => <option key={f} value={f.toLowerCase()}>{f}</option>)}
            </select>
          </div>
          <Input label="Tasa de cierre estimada (%)" type="number" min={0} max={100} value={form.tasa_cierre}
            onChange={(e) => setForm(p => ({ ...p, tasa_cierre: e.target.value }))} placeholder="30" />
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">Guardar público</Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: IDENTIDAD VISUAL
// ═══════════════════════════════════════════════════════════════════════════════

export function TabVisual({
  data,
  onUpdate,
}: {
  data: BrandBuilderData
  onUpdate: (u: Partial<BrandBuilderData>) => void
}) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    color_primario: data.color_primario ?? '#1B2E6B',
    color_secundario: data.color_secundario ?? '#D4A017',
    color_acento: data.color_acento ?? '',
    tipografia_principal: data.tipografia_principal ?? '',
    tipografia_secundaria: data.tipografia_secundaria ?? '',
    estilo_grafico: data.estilo_grafico ?? '',
    estilo_fotografico: data.estilo_fotografico ?? '',
    tagline: data.tagline ?? '',
  })

  const handleSave = async () => {
    setIsSaving(true); setError(null)
    const result = await saveIdentidadVisualAction({
      color_primario: form.color_primario || undefined,
      color_secundario: form.color_secundario || undefined,
      color_acento: form.color_acento || undefined,
      tipografia_principal: form.tipografia_principal || undefined,
      tipografia_secundaria: form.tipografia_secundaria || undefined,
      estilo_grafico: form.estilo_grafico || undefined,
      estilo_fotografico: form.estilo_fotografico || undefined,
      tagline: form.tagline || undefined,
    })
    if (result.success) {
      toast.success('Guardado', 'Identidad visual actualizada.')
      onUpdate({ color_primario: form.color_primario, color_secundario: form.color_secundario, tagline: form.tagline || null })
    } else { setError(result.error) }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Colores de marca</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'color_primario', label: 'Color primario' },
            { key: 'color_secundario', label: 'Color secundario' },
            { key: 'color_acento', label: 'Color acento (opcional)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form[key as keyof typeof form] || '#ffffff'}
                  onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <input type="text" value={form[key as keyof typeof form] as string}
                  onChange={(e) => { if (isValidHexColor(e.target.value) || e.target.value === '') setForm(p => ({ ...p, [key]: e.target.value })) }}
                  className="flex-1 h-9 px-2 text-xs font-mono rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500" placeholder="#000000" />
              </div>
            </div>
          ))}
        </div>
        {/* Preview */}
        <div className="rounded-xl overflow-hidden h-14 flex" style={{ background: `linear-gradient(135deg, ${form.color_primario} 60%, ${form.color_secundario})` }}>
          <div className="flex-1 flex items-center px-4">
            <span className="text-white font-bold text-sm opacity-80">Preview de marca</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Tipografía</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Fuente principal" value={form.tipografia_principal} onChange={(e) => setForm(p => ({ ...p, tipografia_principal: e.target.value }))} placeholder="Inter, Montserrat, Poppins..." />
          <Input label="Fuente secundaria" value={form.tipografia_secundaria} onChange={(e) => setForm(p => ({ ...p, tipografia_secundaria: e.target.value }))} placeholder="Open Sans, Lato..." />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Estilo visual</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estilo gráfico</label>
            <select value={form.estilo_grafico} onChange={(e) => setForm(p => ({ ...p, estilo_grafico: e.target.value }))}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500">
              <option value="">Selecciona...</option>
              {['Moderno y limpio', 'Clásico y profesional', 'Minimalista', 'Vibrante y colorido', 'Corporativo', 'Cálido y familiar'].map(e => <option key={e} value={e.toLowerCase().replace(/ /g, '_')}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estilo fotográfico</label>
            <select value={form.estilo_fotografico} onChange={(e) => setForm(p => ({ ...p, estilo_fotografico: e.target.value }))}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500">
              <option value="">Selecciona...</option>
              {['Profesional en estudio', 'Natural y auténtico', 'Lifestyle', 'Educativo con props', 'Familiar y comunitario'].map(e => <option key={e} value={e.toLowerCase().replace(/ /g, '_')}>{e}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">Tagline</h3>
        <Input label="Tu tagline / eslogan" value={form.tagline} onChange={(e) => setForm(p => ({ ...p, tagline: e.target.value }))}
          placeholder="Ej: Protejo familias latinas en USA" helperText="Máximo 80 caracteres" maxLength={80} />
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">Guardar visual</Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REDES SOCIALES
// ═══════════════════════════════════════════════════════════════════════════════

export function TabRedes({
  data,
  onUpdate,
}: {
  data: BrandBuilderData
  onUpdate: (u: Partial<BrandBuilderData>) => void
}) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    instagram_handle: data.instagram_handle ?? '',
    facebook_url: data.facebook_url ?? '',
    tiktok_handle: data.tiktok_handle ?? '',
    linkedin_url: data.linkedin_url ?? '',
    youtube_url: data.youtube_url ?? '',
    pinterest_url: data.pinterest_url ?? '',
    whatsapp_business: data.whatsapp_business ?? '',
    calendly_url: data.calendly_url ?? '',
    sitio_web: data.sitio_web ?? '',
  })

  const handleSave = async () => {
    setIsSaving(true); setError(null)
    const toSave: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(form)) {
      toSave[k] = v || undefined
    }
    const result = await saveRedesSocialesAction(toSave)
    if (result.success) {
      toast.success('Guardado', 'Redes sociales actualizadas.')
      onUpdate({ instagram_handle: form.instagram_handle || null })
    } else { setError(result.error) }
    setIsSaving(false)
  }

  const NETWORKS = [
    { key: 'instagram_handle', label: 'Instagram', icon: '📸', placeholder: '@tuusuario', prefix: '' },
    { key: 'facebook_url', label: 'Facebook', icon: '👍', placeholder: 'facebook.com/tupagina', prefix: '' },
    { key: 'tiktok_handle', label: 'TikTok', icon: '🎵', placeholder: '@tuusuario', prefix: '' },
    { key: 'linkedin_url', label: 'LinkedIn', icon: '💼', placeholder: 'linkedin.com/in/tuusuario', prefix: '' },
    { key: 'youtube_url', label: 'YouTube', icon: '▶️', placeholder: 'youtube.com/@tucanal', prefix: '' },
    { key: 'pinterest_url', label: 'Pinterest', icon: '📌', placeholder: 'pinterest.com/tuusuario', prefix: '' },
    { key: 'whatsapp_business', label: 'WhatsApp Business', icon: '💬', placeholder: '+1 305 555 1234', prefix: '' },
    { key: 'calendly_url', label: 'Calendly', icon: '📅', placeholder: 'calendly.com/tuusuario', prefix: '' },
    { key: 'sitio_web', label: 'Sitio web', icon: '🌐', placeholder: 'tusitio.com', prefix: '' },
  ]

  return (
    <div className="space-y-5">
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="text-xs text-gray-400">
        Estos datos se incluyen automáticamente en el contenido generado cuando son relevantes (bio, carruseles, CTA de posts).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {NETWORKS.map(({ key, label, icon, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {icon} {label}
            </label>
            <input
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">Guardar redes</Button>
      </div>
    </div>
  )
}
