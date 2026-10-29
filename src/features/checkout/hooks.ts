import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { api } from '@/shared/api/endpoints'
import { ApiError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { quote as quoteSchema, type CreateOrderInput, type Network, type Order, type Quote, type WalletProvider } from '@/shared/contracts'
import { useSession } from '@/shared/session/session-store'
import { orderAttempts } from './order-attempt'

/**
 * Server quote for the current cart version and network. The key includes the
 * cart version, so any cart change (including realtime price updates, which
 * invalidate the cart) produces a fresh quote.
 */
export function useQuote(network: Network, cartVersion: number | undefined, enabled = true) {
  const owner = useSession()?.user.id ?? 'guest'
  return useQuery({
    queryKey: qk.quote(owner, network, cartVersion ?? -1),
    queryFn: () => api.checkout.quote(network),
    enabled: enabled && cartVersion !== undefined,
    staleTime: 60_000,
  })
}

export function useWallets() {
  const userId = useSession()?.user.id
  return useQuery({
    queryKey: qk.wallets(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.account.wallets({ signal }),
    enabled: Boolean(userId),
  })
}

export function useConnectWallet() {
  return useMutation({
    mutationFn: ({ walletId, provider, network }: { walletId: string; provider: WalletProvider; network: Network }) =>
      api.checkout.connectWallet(walletId, provider, network),
  })
}

export function useDisconnectWallet() {
  return useMutation({ mutationFn: (walletId: string) => api.checkout.disconnectWallet(walletId) })
}

/** Fresh quote returned by the server when it rejects a stale one. */
export function staleQuoteFrom(error: unknown): Quote | null {
  const apiError = ApiError.from(error)
  if (apiError.code !== 'QUOTE_STALE' && apiError.code !== 'OUT_OF_STOCK') return null
  const details = apiError.details as { quote?: unknown } | undefined
  const parsed = quoteSchema.safeParse(details?.quote)
  return parsed.success ? parsed.data : null
}

/**
 * Submits the order idempotently. A synchronous lock blocks double clicks
 * before React re-renders; retries reuse the same key and payload.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id
  const inFlight = useRef(false)

  const mutation = useMutation({
    mutationFn: async (payload: CreateOrderInput): Promise<Order> => {
      if (!userId) throw new ApiError({ kind: 'http', status: 401, code: 'UNAUTHENTICATED', message: 'Entre para continuar.' })
      const attempt = orderAttempts.forPayload(userId, payload)
      const order = await api.checkout.createOrder(attempt.payload, attempt.key)
      orderAttempts.setOrder(userId, order.id)
      return order
    },
    onSuccess: (order) => {
      if (userId) queryClient.setQueryData(qk.order(userId, order.id), order)
    },
    onError: (error) => {
      // A rejected quote means a new payload next time: drop the old key.
      if (userId && staleQuoteFrom(error)) orderAttempts.clear(userId)
    },
  })

  const submit = async (payload: CreateOrderInput) => {
    if (inFlight.current) return undefined
    inFlight.current = true
    try {
      return await mutation.mutateAsync(payload)
    } finally {
      inFlight.current = false
    }
  }

  return { ...mutation, submit }
}

/** Order status: realtime events update the cache; polling is a fallback. */
export function useOrder(orderId: string) {
  const userId = useSession()?.user.id
  return useQuery({
    queryKey: qk.order(userId ?? 'anonymous', orderId),
    queryFn: ({ signal }) => api.checkout.order(orderId, { signal }),
    enabled: Boolean(userId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5_000 : false),
  })
}
