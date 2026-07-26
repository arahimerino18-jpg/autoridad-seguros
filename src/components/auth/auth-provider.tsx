'use client'

/**
 * AuthProvider — Autoridad Seguros AI™
 *
 * RESPONSIBILITY: session state distribution only.
 * NEVER redirects. NEVER calls router.push().
 * All routing is server-side (middleware + layout + page).
 *
 * Root cause of the dashboard loop:
 *   onAuthStateChange fires INITIAL_SESSION on every RSC navigation.
 *   Calling loadUserData() there triggered re-renders that the browser
 *   counted as new navigations → "Throttling navigation" loop.
 *
 * Fix: only react to SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED.
 *   Skip INITIAL_SESSION — server already loaded the data.
 */

import {
  createContext, useContext, useEffect,
  useState, useMemo, useRef, type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, BrandKit, PlanTier } from '@/types/database'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  brandKit: BrandKit | null
  planTier: PlanTier
  isLoading: boolean
  isAuthenticated: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  initialSession: Session | null
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const supabase = createClient()
  const initializedRef = useRef(false)

  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadUserData = async (userId: string) => {
    try {
      const [p, b] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('brand_kits').select('*').eq('user_id', userId).single(),
      ])
      setProfile(p.data as Profile | null)
      setBrandKit(b.data as BrandKit | null)
    } catch {
      // Non-critical
    }
  }

  const refreshProfile = async () => {
    if (user) await loadUserData(user.id)
  }

  // Load profile data once on mount if we have an initial session
  useEffect(() => {
    if (initialSession?.user && !initializedRef.current) {
      initializedRef.current = true
      void loadUserData(initialSession.user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for auth state changes — but SKIP INITIAL_SESSION
  // INITIAL_SESSION fires on every RSC navigation and caused the loop
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION — server already handled this
        if (event === 'INITIAL_SESSION') return

        if (process.env.NODE_ENV === 'development') {
          console.log('[AuthProvider] event:', event, '| user:', session?.user?.id ?? 'none')
        }

        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserData(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setBrandKit(null)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token refreshed — user stays logged in, no need to reload profile
          setUser(session.user)
        }

        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    brandKit,
    planTier: (profile?.plan_tier ?? 'starter') as PlanTier,
    isLoading,
    isAuthenticated: !!user,
    refreshProfile,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, profile, brandKit, isLoading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth() must be inside <AuthProvider>')
  return context
}
