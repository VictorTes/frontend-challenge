import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { local, session, storageKeys } from '@/shared/lib/storage'
import { sessionStore } from '@/shared/session/session-store'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalog data is also pushed via Socket.IO, so a short staleness is enough.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // One automatic retry for transient failures only (network, timeout, 5xx).
      retry: (failureCount, error) => ApiError.from(error).isTransient && failureCount < 1,
      retryDelay: 500,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Mutations are never retried blindly: orders use explicit idempotent retries.
      retry: false,
    },
  },
})

/**
 * Logout or user switch: drop every private query of the previous session.
 * In-flight requests are cancelled first so a late response cannot repopulate it.
 */
sessionStore.onEnd((previous, reason) => {
  void queryClient.cancelQueries({ queryKey: qk.meAll })
  void queryClient.cancelQueries({ queryKey: qk.cartAll })
  queryClient.removeQueries({ queryKey: qk.meAll })
  queryClient.removeQueries({ queryKey: qk.cartAll })
  if (reason === 'logout') {
    // Expiration keeps the checkout draft so the user can resume after signing in.
    session.remove(storageKeys.checkoutDraft(previous.user.id))
    local.remove(storageKeys.checkoutAttempt(previous.user.id))
  }
})
