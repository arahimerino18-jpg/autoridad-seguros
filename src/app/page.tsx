import Link from 'next/link'
import { Button } from '@/components/ui'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-navy-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-brand-navy-500 text-sm">
              Autoridad Seguros AI™
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-brand-navy-500 transition-colors">
              Iniciar sesión
            </Link>
            <Button size="sm" asChild>
              <Link href="/register">Comenzar</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-20 pb-16 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-brand-navy-50 text-brand-navy-600 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 border border-brand-navy-100">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold-400" />
          La plataforma de IA para agentes de seguros hispanos
        </div>
        <h1 className="text-5xl lg:text-6xl font-bold text-brand-navy-500 leading-tight tracking-tight max-w-4xl mx-auto">
          Más autoridad.{' '}
          <span className="text-brand-gold-400">Más clientes.</span>{' '}
          Más tiempo libre.
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Genera contenido para Instagram, Facebook y WhatsApp en segundos.
          Maneja objeciones en tiempo real. Creado para agentes de seguros hispanos en EE.UU.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/register">Empezar ahora — $27/mes</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-400">Sin tarjeta de crédito · Cancela cuando quieras</p>
      </section>

      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '✍️', title: 'Content Studio', desc: 'Posts de Instagram, carruseles de 6 slides y WhatsApp en menos de 60 segundos.' },
            { icon: '🛡️', title: 'Objection AI™', desc: '6 respuestas listas para cualquier objeción — en 30 segundos, mientras hablas.' },
            { icon: '✅', title: 'Compliance automático', desc: 'Revisión automática de CMS y Medicare en cada pieza de contenido generada.' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-100 p-6 shadow-card hover:shadow-card-md transition-shadow">
              <span className="text-3xl mb-4 block">{f.icon}</span>
              <h3 className="text-base font-semibold text-brand-navy-500 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 px-4 sm:px-6 text-center">
        <p className="text-xs text-gray-400">© 2025 Autoridad Seguros AI™ · Merino Insurance Services</p>
      </footer>
    </main>
  )
}
