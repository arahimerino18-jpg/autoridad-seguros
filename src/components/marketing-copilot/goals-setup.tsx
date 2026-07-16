'use client'

import { useState } from 'react'
import { saveGoalsAction } from '@/lib/growth-engine/goals-actions'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const PRODUCTOS = [
  { value: 'medicare', label: 'Medicare', emoji: '🏥' },
  { value: 'aca', label: 'ACA / Salud', emoji: '💊' },
  { value: 'iul', label: 'IUL / Vida', emoji: '📈' },
  { value: 'final_expense', label: 'Gastos Finales', emoji: '🌿' },
  { value: 'life', label: 'Seguro de Vida', emoji: '🛡️' },
  { value: 'mortgage', label: 'Hipotecario', emoji: '🏠' },
]

const OBJETIVOS = [
  { value: 'leads', label: 'Conseguir más leads', desc: 'Atraer nuevos prospectos' },
  { value: 'awareness', label: 'Crecer en redes', desc: 'Más seguidores y visibilidad' },
  { value: 'autoridad', label: 'Posicionarme como experto', desc: 'Ser la referencia en mi nicho' },
  { value: 'referidos', label: 'Más referidos', desc: 'Que mis clientes me recomienden' },
]

const TIEMPOS = [
  { value: 15, label: '15 min/día', desc: 'Muy ocupado' },
  { value: 30, label: '30 min/día', desc: 'Moderado' },
  { value: 60, label: '1 hora/día', desc: 'Comprometido' },
  { value: 120, label: '2+ horas/día', desc: 'Enfocado en marketing' },
]

interface GoalsSetupProps {
  onComplete: () => void
  agentName?: string
}

export function GoalsSetup({ onComplete, agentName }: GoalsSetupProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    objetivo_principal: 'leads' as 'leads' | 'awareness' | 'autoridad' | 'referidos',
    producto_prioritario: '',
    meta_leads: '',
    tiempo_disponible_min: 30,
  })

  const handleSave = async () => {
    setIsSaving(true)
    const mes = new Date().toISOString().slice(0, 7)

    await saveGoalsAction({
      mes,
      objetivo_principal: form.objetivo_principal,
      producto_prioritario: form.producto_prioritario || null,
      meta_leads: form.meta_leads ? parseInt(form.meta_leads) : null,
      meta_clientes: null,
      tiempo_disponible_min: form.tiempo_disponible_min,
      notas: null,
    })

    onComplete()
  }

  const firstName = agentName?.split(' ')[0] ?? 'Agente'

  return (
    <div className="max-w-xl mx-auto py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-brand-navy-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🧠</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Hola, {firstName} — soy tu Director de Marketing
        </h1>
        <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
          Para darte recomendaciones relevantes, necesito saber qué quieres lograr este mes.
          Solo toma 60 segundos.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-6">
        {/* Objetivo principal */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            ¿Cuál es tu meta principal este mes?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {OBJETIVOS.map((obj) => (
              <button
                key={obj.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, objetivo_principal: obj.value as typeof form.objetivo_principal }))}
                className={cn(
                  'text-left p-3 rounded-xl border-2 transition-all',
                  form.objetivo_principal === obj.value
                    ? 'border-brand-navy-500 bg-brand-navy-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <p className="text-sm font-medium text-gray-800">{obj.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{obj.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Producto prioritario */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            ¿Qué producto quieres priorizar?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRODUCTOS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setForm(prev => ({
                  ...prev,
                  producto_prioritario: prev.producto_prioritario === p.value ? '' : p.value
                }))}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                  form.producto_prioritario === p.value
                    ? 'border-brand-navy-500 bg-brand-navy-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span className="text-xl">{p.emoji}</span>
                <span className="text-xs font-medium text-gray-700">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Meta de leads */}
        {form.objetivo_principal === 'leads' && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              ¿Cuántos leads quieres conseguir este mes?
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={form.meta_leads}
              onChange={(e) => setForm(p => ({ ...p, meta_leads: e.target.value }))}
              placeholder="Ej: 20"
              className="w-full h-10 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Esto ayuda al Copilot a calibrar el volumen y urgencia de sus recomendaciones
            </p>
          </div>
        )}

        {/* Tiempo disponible */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            ¿Cuánto tiempo tienes al día para contenido?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIEMPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, tiempo_disponible_min: t.value }))}
                className={cn(
                  'flex justify-between items-center p-3 rounded-xl border-2 transition-all',
                  form.tiempo_disponible_min === t.value
                    ? 'border-brand-navy-500 bg-brand-navy-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span className="text-sm font-medium text-gray-800">{t.label}</span>
                <span className="text-xs text-gray-400">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          size="lg"
          isLoading={isSaving}
          loadingText="Configurando tu Director de Marketing..."
          disabled={!form.objetivo_principal}
        >
          Activar mi Director de Marketing →
        </Button>
      </div>
    </div>
  )
}
