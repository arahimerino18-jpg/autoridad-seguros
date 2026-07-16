import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAgentDataExport, logExportEvent } from '@/lib/export/data-export'
import { AgentProfilePDF } from '@/lib/export/pdf-generator'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

/**
 * GET /api/export/pdf
 * Generates a real PDF binary using @react-pdf/renderer.
 * Server-side only. Privacy-safe — excludes all secrets and other users' data.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, recordCount, error } = await buildAgentDataExport(user.id)
  if (error) return NextResponse.json({ error }, { status: 500 })

  try {
    // Generate PDF buffer server-side
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = createElement(AgentProfilePDF, data) as any
    const pdfBuffer = await renderToBuffer(element)

    // Log export event
    void logExportEvent(user.id, 'pdf', [
      'perfil', 'intelligence_profile', 'actividad', 'compliance', 'metricas'
    ], recordCount)

    const filename = `autoridad-seguros-perfil-${new Date().toISOString().slice(0, 10)}.pdf`

    const uint8 = new Uint8Array(pdfBuffer)
    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(uint8.length),
      },
    })
  } catch (pdfErr) {
    console.error('[PDF Export] Render error:', pdfErr)
    // Fallback: return formatted text if PDF rendering fails
    const { buildPDFContent } = await import('@/lib/export/pdf-formatter')
    const textContent = buildPDFContent(data)
    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="autoridad-seguros-perfil-${new Date().toISOString().slice(0, 10)}.txt"`,
      },
    })
  }
}
