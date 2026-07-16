import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui'

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  post: { label: 'Post', color: 'bg-brand-navy-50 text-brand-navy-600' },
  carousel: { label: 'Carrusel', color: 'bg-brand-sky-50 text-brand-sky-600' },
  whatsapp: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700' },
  reel: { label: 'Reel', color: 'bg-purple-50 text-purple-700' },
  email: { label: 'Email', color: 'bg-orange-50 text-orange-700' },
  sms: { label: 'SMS', color: 'bg-yellow-50 text-yellow-700' },
  story: { label: 'Story', color: 'bg-pink-50 text-pink-700' },
}

const PRODUCT_LABELS: Record<string, string> = {
  medicare: 'Medicare', aca: 'ACA', iul: 'IUL',
  final_expense: 'Gastos Finales', life: 'Vida',
  mortgage: 'Hipotecario', general: 'General',
}

interface RecentContentProps {
  items: Record<string, unknown>[]
}

export function RecentContent({ items }: RecentContentProps) {
  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Contenido reciente
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <EmptyState
            icon={
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            }
            title="Aún no tienes contenido"
            description="Genera tu primer post de Medicare en menos de 60 segundos."
            action={
              <Link
                href="/content-studio"
                className="text-sm font-medium text-brand-navy-500 hover:underline"
              >
                Ir al Content Studio →
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Contenido reciente
        </h2>
        <Link
          href="/content-studio"
          className="text-xs font-medium text-brand-sky-500 hover:underline"
        >
          Ver todo
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
        {items.map((item) => {
          const tipo = (item.tipo as string) ?? 'post'
          const typeConfig = TYPE_CONFIG[tipo] ?? TYPE_CONFIG.post
          const producto = (item.producto as string) ?? 'general'
          const titulo = (item.titulo as string) || 'Sin título'
          const createdAt = item.created_at as string
          const compliance = item.compliance_revisado as boolean

          return (
            <div
              key={item.id as string}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-2xs font-medium px-1.5 py-0.5 rounded ${typeConfig.color}`}
                  >
                    {typeConfig.label}
                  </span>
                  <span className="text-2xs text-gray-400">
                    {PRODUCT_LABELS[producto] ?? producto}
                  </span>
                  {compliance && (
                    <span title="Compliance verificado">🟢</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700 truncate">{titulo}</p>
              </div>
              <span className="text-2xs text-gray-400 shrink-0">
                {formatRelativeTime(createdAt)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
