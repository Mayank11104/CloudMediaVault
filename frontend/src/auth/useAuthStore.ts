import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

interface User {
  email: string
  name: string
  sub: string
}

interface AuthState {
  user: User | null
  setUser: (user: User) => void
  setTokens: (tokens: { email: string; name: string }) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),

      setTokens: (tokens) =>
        set({
          user: {
            email: tokens.email,
            name: tokens.name,
            sub: '',
          },
        }),

      logout: async () => {
        try {
          await api('/auth/logout', { method: 'POST' })
        } catch (err) {
          console.error('Backend logout failed:', err)
        }
        set({ user: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

export const useIsAuth = () => useAuthStore((s) => !!s.user)
