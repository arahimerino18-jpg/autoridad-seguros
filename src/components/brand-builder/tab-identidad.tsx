'use client'

import { useState } from 'react'
import { Input, Textarea, Button, Alert } from '@/components/ui'
import { saveIdentidadProfesionalAction } from '@/lib/brand-builder/actions'
import type { BrandBuilderData } from './brand-builder'
import { useToast } from '@/hooks/use-toast'

const US_STATES_OPTIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const LANGUAGE_OPTIONS = ['Español', 'English', 'Português', 'Français']

interface Props {
  data: BrandBuilderData
  onUpdate: (updates: Partial<BrandBuilderData>) => void
}

export function TabIdentidad({ data, onUpdate }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    nombre_completo: data.nombre_completo ?? '',
    nombre_comercial: data.nombre_comercial ?? '',
    nombre_agencia: data.nombre_agencia ?? '',
    anos_experiencia: data.anos_experiencia?.toString() ?? '',
    numero_licencia: data.numero_licencia ?? '',
    certificaciones: data.certificaciones?.join(', ') ?? '',
    estados_licencia: data.estados_licencia ?? [],
    idiomas: data.idiomas ?? ['Español'],
    historia_profesional: data.historia_profesional ?? '',
    historia_personal: data.historia_personal ?? '',
    mision: data.mision ?? '',
    vision: data.vision ?? '',
    valores: data.valores?.join(', ') ?? '',
  })

  const toggleEstado = (estado: string) => {
    setForm((prev) => ({
      ...prev,
      estados_licencia: prev.estados_licencia.includes(estado)
        ? prev.estados_licencia.filter((e) => e !== estado)
        : [...prev.estados_licencia, estado],
    }))
  }

  const toggleIdioma = (idioma: string) => {
    setForm((prev) => ({
      ...prev,
      idiomas: prev.idiomas.includes(idioma)
        ? prev.idiomas.filter((i) => i !== idioma)
        : [...prev.idiomas, idioma],
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    const result = await saveIdentidadProfesionalAction({
      nombre_completo: form.nombre_completo || undefined,
      nombre_comercial: form.nombre_comercial || undefined,
      nombre_agencia: form.nombre_agencia || undefined,
      anos_experiencia: form.anos_experiencia ? parseInt(form.anos_experiencia) : undefined,
      numero_licencia: form.numero_licencia || undefined,
      certificaciones: form.certificaciones
        ? form.certificaciones.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      estados_licencia: form.estados_licencia.length > 0 ? form.estados_licencia : undefined,
      idiomas: form.idiomas.length > 0 ? form.idiomas : undefined,
      historia_profesional: form.historia_profesional || undefined,
      historia_personal: form.historia_personal || undefined,
      mision: form.mision || undefined,
      vision: form.vision || undefined,
      valores: form.valores
        ? form.valores.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    })

    if (result.success) {
      toast.success('Guardado', 'Identidad profesional actualizada.')
      onUpdate({
        nombre_completo: form.nombre_completo,
        nombre_comercial: form.nombre_comercial || null,
        nombre_agencia: form.nombre_agencia || null,
        historia_profesional: form.historia_profesional || null,
        historia_personal: form.historia_personal || null,
        mision: form.mision || null,
        vision: form.vision || null,
        valores: form.valores ? form.valores.split(',').map((s) => s.trim()).filter(Boolean) : null,
      })
    } else {
      setError(result.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">
          Datos básicos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre completo"
            value={form.nombre_completo}
            onChange={(e) => setForm((p) => ({ ...p, nombre_completo: e.target.value }))}
            placeholder="Arahi Merino"
          />
          <Input
            label="Nombre comercial"
            value={form.nombre_comercial}
            onChange={(e) => setForm((p) => ({ ...p, nombre_comercial: e.target.value }))}
            placeholder="Merino Insurance Services"
            helperText="Tu marca o nombre de negocio"
          />
          <Input
            label="Agencia / FMO"
            value={form.nombre_agencia}
            onChange={(e) => setForm((p) => ({ ...p, nombre_agencia: e.target.value }))}
            placeholder="Nombre de tu agencia"
          />
          <Input
            label="Años de experiencia"
            type="number"
            min={0}
            max={50}
            value={form.anos_experiencia}
            onChange={(e) => setForm((p) => ({ ...p, anos_experiencia: e.target.value }))}
            placeholder="7"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Número de licencia"
            value={form.numero_licencia}
            onChange={(e) => setForm((p) => ({ ...p, numero_licencia: e.target.value }))}
            placeholder="FL-L123456"
          />
          <Input
            label="Certificaciones"
            value={form.certificaciones}
            onChange={(e) => setForm((p) => ({ ...p, certificaciones: e.target.value }))}
            placeholder="AHIP, SOA, Ej. separadas por coma"
            helperText="Separadas por comas"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">
          Estados con licencia
        </h3>
        <div className="flex flex-wrap gap-2">
          {US_STATES_OPTIONS.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => toggleEstado(state)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                form.estados_licencia.includes(state)
                  ? 'bg-brand-navy-500 text-white border-brand-navy-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">
          Idiomas
        </h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleIdioma(lang)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                form.idiomas.includes(lang)
                  ? 'bg-brand-navy-500 text-white border-brand-navy-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">
          Tu historia <span className="text-brand-gold-500 font-normal text-xs ml-1">+10% al perfil de IA</span>
        </h3>
        <Textarea
          label="Historia personal — ¿Cómo llegaste a los seguros?"
          value={form.historia_personal}
          onChange={(e) => setForm((p) => ({ ...p, historia_personal: e.target.value }))}
          rows={4}
          placeholder="Cuéntanos tu historia. ¿Qué te motivó? ¿Hubo alguna experiencia que cambió tu perspectiva? Escribe como si le hablaras a un prospecto."
          characterCount
          maxLength={1000}
          helperText="La IA usa esto para humanizar todo el contenido generado"
        />
        <Textarea
          label="Historia profesional — Tu trayectoria"
          value={form.historia_profesional}
          onChange={(e) => setForm((p) => ({ ...p, historia_profesional: e.target.value }))}
          rows={3}
          placeholder="Años de experiencia, logros, especializaciones, reconocimientos..."
          characterCount
          maxLength={800}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 pb-1 border-b border-gray-100">
          Misión, visión y valores
        </h3>
        <Textarea
          label="Misión profesional"
          value={form.mision}
          onChange={(e) => setForm((p) => ({ ...p, mision: e.target.value }))}
          rows={2}
          placeholder="Ej: Proteger a las familias latinas en USA para que ninguna enfrente una crisis de salud sin apoyo..."
          characterCount
          maxLength={300}
          helperText="Una frase que define el impacto que quieres tener"
        />
        <Textarea
          label="Visión a 3-5 años"
          value={form.vision}
          onChange={(e) => setForm((p) => ({ ...p, vision: e.target.value }))}
          rows={2}
          placeholder="Cómo te ves en el futuro: mercados, equipo, impacto..."
          characterCount
          maxLength={300}
        />
        <Input
          label="Valores (separados por coma)"
          value={form.valores}
          onChange={(e) => setForm((p) => ({ ...p, valores: e.target.value }))}
          placeholder="Honestidad, familia, servicio, educación"
          helperText="Los principios que guían tu trabajo"
        />
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">
          Guardar identidad
        </Button>
      </div>
    </div>
  )
}
