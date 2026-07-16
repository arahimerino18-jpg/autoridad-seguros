import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { AuthProvider } from '@/components/auth/auth-provider'
import './globals.css'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
export const metadata: Metadata = { title: { default: 'Autoridad Seguros AI™', template: '%s | Autoridad Seguros AI™' }, description: 'La plataforma de IA para agentes de seguros hispanos.', robots: { index: false, follow: false } }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return (<html lang="es" suppressHydrationWarning><body className={`${inter.variable} font-sans antialiased`}><AuthProvider initialSession={session}>{children}</AuthProvider></body></html>)
}
