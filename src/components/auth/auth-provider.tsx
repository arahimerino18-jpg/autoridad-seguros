'use client'

/**
 * AuthProvider — Autoridad Seguros AI™
 *
 * ARCHITECTURE DECISION: Single provider at the root, not per-component fetching.
 *
 * Why this matters at scale:
 *   - Without this: every Client Component that needs the user calls
 *     supabase.auth.getUser() independently. At 100k users with 8 components
 *     per page = 800k redundant calls per page load.
 *   - With this: ONE call at the root, distributed to all children via Context.
 *
 * Session refresh: The Supabase SSR client handles token refresh automatically
 * via cookies. This provider handles the CLIENT-SIDE state synchronization,
 * listening to onAuthStateChange to keep the UI in sync when the token refreshes.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, BrandKit, PlanTier } from '@/types/database'

// ─── Context shape ────────────────────────────────────────────────────────────

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

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
  /**
   * Initial session from the Server Component.
   * Passing this eliminates the client-side loading flash —
   * the provider starts with the correct state immediately.
   */
  initialSession: Session | null
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [isLoading, setIsLoading] = useState(!initialSession)

  // Load profile and brand kit for a given user
  const loadUserData = async (userId: string) => {
    const [profileResult, brandKitResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('brand_kits').select('*').eq('user_id', userId).single(),
    ])

    setProfile(profileResult.data)
    setBrandKit(brandKitResult.data)
  }

  // Public method to manually refresh profile (e.g., after onboarding step save)
  const refreshProfile = async () => {
    if (!user) return
    await loadUserData(user.id)
  }

  // Initial load from server-provided session
  useEffect(() => {
    if (initialSession?.user) {
      setIsLoading(true)
      loadUserData(initialSession.user.id).finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe to auth state changes (token refresh, logout from another tab, etc.)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadUserData(session.user.id)
      } else {
        setProfile(null)
        setBrandKit(null)
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      brandKit,
      planTier: (profile?.plan_tier ?? 'starter') as PlanTier,
      isLoading,
      isAuthenticated: !!user,
      refreshProfile,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, profile, brandKit, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAuth — access session state in any Client Component.
 *
 * Example:
 *   const { user, profile, planTier } = useAuth()
 *
 * Throws if used outside AuthProvider — fail fast, not silently.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth() must be used inside <AuthProvider>. ' +
        'Make sure your component tree includes AuthProvider at the root.'
    )
  }

  return context
}
