import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/endpoints'
import { qk } from '@/shared/api/query-keys'
import type { AddCartItemInput, Cart } from '@/shared/contracts'
import { sessionStore, useSession } from '@/shared/session/session-store'

export function useCartOwner() {
  return useSession()?.user.id ?? 'guest'
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })
}

export function useCartCount() {
  const { data } = useCart()
  return data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
}

/**
 * Cart mutations return the full cart; the server response replaces the cache
 * (it is authoritative for stock/limits), and any open quote is refreshed.
 */
function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      // A late response from a previous session must not repopulate its
      // private cart after logout or a user switch.
      if (owner !== (sessionStore.userId() ?? 'guest')) return
      // A cart refetch started before this mutation reached the server (e.g. the
      // reconnect reconciliation) would land later with the older cart: cancel it.
      void queryClient.cancelQueries({ queryKey: qk.cart(owner) })
      // Concurrent mutations (two rows at once) may resolve out of order: a
      // response older than the cached cart must not overwrite it.
      queryClient.setQueryData<Cart>(qk.cart(owner), (current) =>
        current && current.version > cart.version ? current : cart,
      )
      if (owner !== 'guest') void queryClient.invalidateQueries({ queryKey: qk.quoteAll(owner) })
    },
    onError: () => {
      // Stock may have changed: resync the cart with the server.
      void queryClient.invalidateQueries({ queryKey: qk.cart(owner) })
    },
  })
}

export function useAddToCart() {
  return useCartMutation((input: AddCartItemInput) => api.cart.addItem(input))
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) =>
    api.cart.updateItem(itemId, quantity),
  )
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => api.cart.removeItem(itemId))
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api.cart.applyCoupon(code))
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.cart.removeCoupon())
}

export function useAcknowledgePrices() {
  return useCartMutation(() => api.cart.acknowledgePrices())
}
