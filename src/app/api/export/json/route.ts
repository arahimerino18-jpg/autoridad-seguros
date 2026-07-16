import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAgentDataExport, logExportEvent } from '@/lib/export/data-export'

// ─── GET /api/export/json ─────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, recordCount, error } = await buildAgentDataExport(user.id)

  if (error) return NextResponse.json({ error }, { status: 500 })

  // Log the export event (non-blocking)
  void logExportEvent(user.id, 'json', [
    'perfil', 'intelligence_profile', 'inferencias', 'historial',
    'contenidos', 'objeciones', 'compliance', 'briefings', 'metricas'
  ], recordCount)

  const filename = `autoridad-seguros-datos-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Records': String(recordCount),
      'X-Export-Version': '1.0',
    },
  })
}
