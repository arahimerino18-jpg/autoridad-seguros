'use client'

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

  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  // If we have an initial session from the server, start as NOT loading
  // to prevent flash. If no session, also not loading — just unauthenticated.
  const [isLoading, setIsLoading] = useState(false)

  const loadUserData = async (userId: string) => {
    try {
      const [profileResult, brandKitResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('brand_kits').select('*').eq('user_id', userId).single(),
      ])
      setProfile(profileResult.data)
      setBrandKit(brandKitResult.data)
    } catch {
      // Non-critical — profile may not exist yet during onboarding
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    await loadUserData(user.id)
  }

  // Load profile data for initial server session
  useEffect(() => {
    if (initialSession?.user) {
      void loadUserData(initialSession.user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for auth state changes (sign in, sign out, token refresh)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null
        setUser(newUser)

        if (newUser) {
          await loadUserData(newUser.id)
        } else {
          setProfile(null)
          setBrandKit(null)
        }

        setIsLoading(false)
      }
    )

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

  // Show a minimal loading state instead of blank screen
  if (isLoading) {
    return (
      <AuthContext.Provider value={value}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
        }}>
          <div style={{
            width: 32,
            height: 32,
            border: '3px solid #e5e7eb',
            borderTopColor: '#1B2E6B',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>.')
  }
  return context
}
