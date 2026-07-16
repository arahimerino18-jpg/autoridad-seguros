import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BibliotecaClient } from '@/components/biblioteca/biblioteca-client'

export const metadata: Metadata = {
  title: 'Mis contenidos | Autoridad Seguros AI™',
}

const PAGE_SIZE = 18

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string
    producto?: string
    publicado?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = parseInt(params.page ?? '1') - 1
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Build query with filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('contenidos') as any)
    .select('id, tipo, plataforma, producto, titulo, cuerpo, output_json, compliance_revisado, fue_publicado, canal_publicacion, created_at, growth_output_id', { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.tipo) query = query.eq('tipo', params.tipo)
  if (params.producto) query = query.eq('producto', params.producto)
  if (params.publicado === 'true') query = query.eq('fue_publicado', true)

  const { data: contenidos, count } = await query

  // Load agent handle for previews
  const { data: bkData } = await supabase
    .from('brand_kits')
    .select('instagram_handle')
    .eq('user_id', user.id)
    .single()

  const agentHandle = (bkData as { instagram_handle?: string } | null)?.instagram_handle

  return (
    <BibliotecaClient
      items={(contenidos ?? []) as Record<string, unknown>[]}
      total={count ?? 0}
      pageSize={PAGE_SIZE}
      currentPage={page + 1}
      agentHandle={agentHandle}
      filters={{
        tipo: params.tipo,
        producto: params.producto,
        publicado: params.publicado === 'true',
      }}
    />
  )
}
