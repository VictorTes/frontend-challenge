import { useEffect, useRef } from 'react'
import { sessionStore } from '@/shared/session/session-store'
import { useCart, useUpdateCartItem } from '../hooks'
import { isUnloading, pendingQuantities } from '../pending'

/**
 * After a reload, re-sends quantity changes the previous page did not get to
 * confirm. Entries from another session or for items no longer in the cart are
 * dropped. Runs once per page load, after the cart is known.
 */
export function PendingCartReplay() {
  const { data: cart } = useCart()
  const update = useUpdateCartItem()
  const done = useRef(false)
  useEffect(() => {
    if (!cart || done.current) return
    done.current = true
    const owner = sessionStore.userId()
    for (const [itemId, entry] of Object.entries(pendingQuantities.all())) {
      const item = cart.items.find((i) => i.id === itemId)
      if (entry.owner !== owner || !item || item.quantity === entry.quantity) {
        pendingQuantities.clear(itemId)
        continue
      }
      update.mutate(
        { itemId, quantity: entry.quantity },
        {
          onSettled: (_cart, error) => {
            if (!error || !isUnloading()) pendingQuantities.clear(itemId, entry.quantity)
          },
        },
      )
    }
  }, [cart, update])
  return null
}
