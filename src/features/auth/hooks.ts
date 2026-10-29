import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/endpoints'
import { qk } from '@/shared/api/query-keys'
import type { LoginInput, RegisterInput, Session } from '@/shared/contracts'
import { local, storageKeys } from '@/shared/lib/storage'
import { sessionStore, useSession } from '@/shared/session/session-store'

/**
 * Starts a session. If another user was signed in, their private cache is
 * dropped first. The guest cart is merged into the user's cart so the items a
 * visitor added are preserved.
 */
async function startSession(queryClient: ReturnType<typeof useQueryClient>, session: Session) {
  const previous = sessionStore.get()
  if (previous && previous.user.id !== session.user.id) sessionStore.end('logout')
  const guestCartId = local.get<string>(storageKeys.guestCart)
  if (guestCartId) {
    // Merge before activating the session so the user's cart query never
    // observes the pre-merge state.
    try {
      const cart = await api.cart.merge(guestCartId, session.token)
      queryClient.setQueryData(qk.cart(session.user.id), cart)
      local.remove(storageKeys.guestCart)
    } catch {
      // Keep the guest cart id: the merge is retried on the next login.
    }
  }
  queryClient.removeQueries({ queryKey: qk.cart('guest') })
  sessionStore.start(session)
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: (session) => startSession(queryClient, session),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => api.auth.register(input),
    onSuccess: (session) => startSession(queryClient, session),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        // Logging out locally must work even if the server is unreachable.
      }
    },
    onSettled: () => sessionStore.end('logout'),
  })
}

/**
 * Revalidates the persisted session on boot. A 401 ends it through the Axios
 * interceptor; network errors keep the local session (offline-tolerant).
 */
export function useSessionRevalidation() {
  const session = useSession()
  return useQuery({
    queryKey: ['session', session?.token],
    queryFn: async ({ signal }) => {
      const fresh = await api.auth.session({ signal })
      sessionStore.updateUser(fresh.user)
      return fresh
    },
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
