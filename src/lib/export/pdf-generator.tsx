/**
 * Autoridad Seguros AI™ — PDF Export Generator
 * Uses @react-pdf/renderer for real PDF binary output.
 * Generated server-side. Privacy-safe (no secrets, no other users' data).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { AgentDataExport, PerformanceMetrics } from '@/types/database'
import { createElement } from 'react'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: '#1a1a1a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#1B2E6B',
    paddingBottom: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1B2E6B',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: '#6b7280',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1B2E6B',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 160,
    fontSize: 9,
    color: '#6b7280',
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: '#111827',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    color: '#1B2E6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1B2E6B',
  },
  metricLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  disclaimer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  disclaimerText: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 8,
    color: '#374151',
    marginRight: 4,
    marginBottom: 3,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
})

// ─── Helper components ────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return createElement(View, { style: S.row },
    createElement(Text, { style: S.label }, label),
    createElement(Text, { style: S.value }, value || '—')
  )
}

function MetricBox({ value, label }: { value: string | number; label: string }) {
  return createElement(View, { style: S.metricBox },
    createElement(Text, { style: S.metricValue }, String(value)),
    createElement(Text, { style: S.metricLabel }, label)
  )
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function AgentProfilePDF(data: AgentDataExport) {
  const exportDate = new Date(data.meta.exported_at).toLocaleDateString('es-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const exportTime = new Date(data.meta.exported_at).toLocaleTimeString('es-US', {
    hour: '2-digit', minute: '2-digit'
  })

  const nombre = (data.perfil?.nombre_completo as string) ?? '—'
  const estado = (data.perfil?.estado_usa as string) ?? '—'
  const plan = (data.perfil?.plan_tier as string) ?? '—'
  // especialidades rendered inline below

  const intel = data.intelligence_profile ?? {}
  const metricas = data.metricas as Partial<PerformanceMetrics> | null

  const sub = (data.perfil as Record<string, unknown>)?.['suscripcion'] as Record<string, unknown> | undefined

  return createElement(Document, {
    title: `Autoridad Seguros AI™ — Perfil de ${nombre}`,
    author: 'Autoridad Seguros AI™',
    subject: 'Exportación de datos del agente',
    language: 'es',
  },
    createElement(Page, { size: 'A4', style: S.page },

      // ── Header ────────────────────────────────────────────────────────────
      createElement(View, { style: S.header },
        createElement(Text, { style: S.title }, 'Autoridad Seguros AI™'),
        createElement(Text, { style: S.subtitle }, `Exportación de datos del agente · ${exportDate} · ${exportTime}`),
        createElement(Text, { style: S.subtitle }, `Versión del reporte: ${data.meta.export_version}`)
      ),

      // ── Perfil básico ──────────────────────────────────────────────────────
      createElement(View, { style: S.section },
        createElement(Text, { style: S.sectionTitle }, '📋 Perfil Básico'),
        createElement(Field, { label: 'Nombre completo', value: nombre }),
        createElement(Field, { label: 'Estado de operación', value: estado }),
        createElement(Field, { label: 'Plan activo', value: plan.charAt(0).toUpperCase() + plan.slice(1) }),
        sub ? createElement(Field, { label: 'Estado suscripción', value: (sub.status as string) ?? '—' }) : null,
        createElement(Field, { label: 'Primer valor generado', value:
          data.perfil?.first_value_generated_at
            ? new Date(data.perfil.first_value_generated_at as string).toLocaleDateString('es-US')
            : '—'
        }),
        createElement(View, { style: S.row },
          createElement(Text, { style: S.label }, 'Especialidades'),
          createElement(View, { style: [S.value, S.tagRow] },
            ...((data.perfil?.especialidades as string[]) ?? []).map(esp =>
              createElement(Text, { style: S.tag, key: esp }, esp)
            )
          )
        )
      ),

      // ── Perfil IA ──────────────────────────────────────────────────────────
      createElement(View, { style: S.section },
        createElement(Text, { style: S.sectionTitle }, '🧠 Perfil Inteligente IA'),
        createElement(Field, { label: 'Tono de comunicación', value: (intel.tono_comunicacion as string) ?? null }),
        createElement(Field, { label: 'Mercado objetivo', value: (intel.mercado_objetivo as string) ?? null }),
        createElement(Field, { label: 'Propuesta de valor', value: (intel.propuesta_de_valor as string) ?? null }),
        createElement(Field, { label: 'Score de perfil', value: `${(intel.score_perfil_completitud as number) ?? 0}/100` }),
        createElement(Field, { label: 'Inferencias pendientes', value: String(data.inferencias_pendientes.length) }),
        createElement(Field, { label: 'Historial de cambios', value: `${data.historial_cambios.length} registros` }),
      ),

      // ── Métricas de actividad ──────────────────────────────────────────────
      createElement(View, { style: S.section },
        createElement(Text, { style: S.sectionTitle }, '📊 Actividad en la Plataforma'),
        createElement(View, { style: S.metricGrid },
          createElement(MetricBox, { value: data.contenidos.length, label: 'Contenidos generados' }),
          createElement(MetricBox, { value: data.objeciones.length, label: 'Objeciones analizadas' }),
          createElement(MetricBox, { value: data.compliance_logs.length, label: 'Revisiones compliance' }),
          createElement(MetricBox, { value: data.briefings.length, label: 'Briefings semanales' }),
        ),
        metricas && createElement(View, null,
          createElement(Field, { label: 'Tasa de utilidad (objeciones)', value: metricas.objections_util_rate ? `${(metricas.objections_util_rate * 100).toFixed(0)}%` : '—' }),
          createElement(Field, { label: 'Compliance nivel BAJO', value: String(metricas.compliance_risk_low ?? 0) }),
          createElement(Field, { label: 'Compliance nivel MEDIO', value: String(metricas.compliance_risk_medium ?? 0) }),
          createElement(Field, { label: 'Compliance nivel ALTO', value: String(metricas.compliance_risk_high ?? 0) }),
        )
      ),

      // ── Nota legal ─────────────────────────────────────────────────────────
      createElement(View, { style: S.disclaimer },
        createElement(Text, { style: S.disclaimerText },
          'Este documento es una exportación de los datos personales y profesionales almacenados en Autoridad Seguros AI™. ' +
          'No incluye contraseñas, tokens de sesión, claves API, datos completos de pago ni información de seguridad interna. ' +
          'Esta información es confidencial y corresponde exclusivamente a la cuenta del agente identificado en este reporte.'
        )
      ),

      // ── Footer ─────────────────────────────────────────────────────────────
      createElement(View, { style: S.footer },
        createElement(Text, { style: S.footerText }, 'Autoridad Seguros AI™'),
        createElement(Text, { style: S.footerText }, `ID: ${data.meta.user_id.slice(0, 8)}...`),
        createElement(Text, { style: S.footerText }, exportDate),
      )
    )
  )
}
