import type { AgentDataExport } from '@/types/database'

// ─── PDF text builder ─────────────────────────────────────────────────────────
// Generates a human-readable plain-text summary for PDF rendering.
// The actual PDF is created client-side from this text.

export function buildPDFContent(data: AgentDataExport): string {
  const lines: string[] = [
    '════════════════════════════════════════════════',
    'AUTORIDAD SEGUROS AI™ — EXPORTACIÓN DE DATOS',
    `Generado: ${new Date(data.meta.exported_at).toLocaleString('es-US', { dateStyle: 'full', timeStyle: 'short' })}`,
    `Versión: ${data.meta.export_version}`,
    '════════════════════════════════════════════════',
    '',
    '── PERFIL BÁSICO ──────────────────────────────',
    `Nombre: ${(data.perfil?.nombre_completo as string) ?? '—'}`,
    `Estado: ${(data.perfil?.estado_usa as string) ?? '—'}`,
    `Plan: ${(data.perfil as Record<string, unknown>)?.['suscripcion'] ? JSON.stringify((data.perfil as Record<string, unknown>)?.['suscripcion']) : (data.perfil?.plan_tier as string) ?? '—'}`,
    `Especialidades: ${((data.perfil?.especialidades as string[]) ?? []).join(', ') || '—'}`,
    `Primer valor generado: ${data.perfil?.first_value_generated_at ? new Date(data.perfil.first_value_generated_at as string).toLocaleDateString('es-US') : '—'}`,
    '',
    '── PERFIL INTELIGENTE IA ──────────────────────',
    `Tono de comunicación: ${(data.intelligence_profile?.tono_comunicacion as string) ?? '—'}`,
    `Mercado objetivo: ${(data.intelligence_profile?.mercado_objetivo as string) ?? '—'}`,
    `Propuesta de valor: ${(data.intelligence_profile?.propuesta_de_valor as string) ?? '—'}`,
    `Score de perfil: ${(data.intelligence_profile?.score_perfil_completitud as number) ?? 0}/100`,
    `Inferencias pendientes: ${data.inferencias_pendientes.length}`,
    '',
    '── ACTIVIDAD ──────────────────────────────────',
    `Contenidos generados: ${data.contenidos.length}`,
    `Objeciones analizadas: ${data.objeciones.length}`,
    `Revisiones de compliance: ${data.compliance_logs.length}`,
    `Briefings semanales guardados: ${data.briefings.length}`,
    `Cambios al perfil registrados: ${data.historial_cambios.length}`,
    '',
    '── MÉTRICAS DE COMPLIANCE ─────────────────────',
    `Revisiones nivel BAJO: ${data.metricas?.compliance_risk_low ?? 0}`,
    `Revisiones nivel MEDIO: ${data.metricas?.compliance_risk_medium ?? 0}`,
    `Revisiones nivel ALTO: ${data.metricas?.compliance_risk_high ?? 0}`,
    '',
    '── NOTA LEGAL ─────────────────────────────────',
    'Este documento es un resumen de los datos personales y profesionales',
    'almacenados en Autoridad Seguros AI™. No incluye contraseñas, tokens',
    'de sesión, claves API, datos de pago completos ni información de',
    'seguridad interna.',
    '════════════════════════════════════════════════',
  ]

  return lines.join('\n')
}
