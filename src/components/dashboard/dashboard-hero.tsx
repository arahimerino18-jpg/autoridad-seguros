interface DashboardHeroProps {
  profile: Record<string, unknown>
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function DashboardHero({ profile }: DashboardHeroProps) {
  const nombre = (profile.nombre_completo as string) ?? 'Agente'
  const firstName = nombre.split(' ')[0]
  const greeting = getGreeting()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting}, {firstName} 👋
      </h1>
      <p className="text-gray-500 text-sm mt-0.5">
        ¿Qué generamos hoy para hacer crecer tu negocio?
      </p>
    </div>
  )
}
