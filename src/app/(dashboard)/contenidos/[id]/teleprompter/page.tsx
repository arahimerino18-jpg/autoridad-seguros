import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeleprompterClient } from '@/components/biblioteca/teleprompter-client'
import type { ReelScriptOutput } from '@/lib/content-studio/channel-registry'

export default async function TeleprompterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('contenidos') as any)
    .select('id, titulo, output_json, tipo')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!data || !data.output_json) {
    redirect('/contenidos')
  }

  const item = data as { id: string; titulo: string; output_json: ReelScriptOutput; tipo: string }

  // Verify it's a reel script
  if (!item.output_json.segmentos) {
    redirect('/contenidos')
  }

  return (
    <TeleprompterClient
      titulo={item.titulo}
      script={item.output_json}
      backHref="/contenidos"
    />
  )
}
