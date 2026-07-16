import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: {
    default: 'Acceder',
    template: '%s | Autoridad Seguros AI™',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel — Brand ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-navy-500 p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #4A90D9 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 40%)`,
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-white font-semibold text-lg">Autoridad Seguros AI™</span>
        </Link>

        {/* Value props */}
        <div className="relative space-y-6">
          <blockquote className="text-white">
            <p className="text-2xl font-semibold leading-snug mb-4">
              &ldquo;Pasé de publicar una vez a la semana a publicar todos los días — y mis
              leads se triplicaron en 60 días.&rdquo;
            </p>
            <footer className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-gold-400 flex items-center justify-center text-white font-bold">
                AM
              </div>
              <div>
                <p className="text-white font-medium text-sm">Arahi Merino</p>
                <p className="text-white/60 text-xs">Agente Medicare · Florida</p>
              </div>
            </footer>
          </blockquote>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            {[
              { value: '5 min', label: 'Para tu primer post' },
              { value: '400+', label: 'Respuestas de objeción' },
              { value: '$0', label: 'Para empezar hoy' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-brand-gold-400">{stat.value}</p>
                <p className="text-white/60 text-xs mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-white/40 text-xs">
          © 2025 Autoridad Seguros AI™ · Merino Insurance Services
        </p>
      </div>

      {/* ── Right panel — Form ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-lg bg-brand-navy-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-brand-navy-500 text-sm">
              Autoridad Seguros AI™
            </span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  )
}
