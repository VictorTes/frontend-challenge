import { session, storageKeys } from '@/shared/lib/storage'

type Entry = { owner: string | null; quantity: number }
type Pending = Record<string, Entry>

/**
 * Quantity changes still inside the debounce window (or in flight) are mirrored
 * in sessionStorage, so a reload right after clicking "+" does not lose them:
 * PendingCartReplay re-sends them once the cart loads again.
 */
export const pendingQuantities = {
  all: (): Pending => session.get<Pending>(storageKeys.cartPending) ?? {},
  set(itemId: string, entry: Entry) {
    session.set(storageKeys.cartPending, { ...pendingQuantities.all(), [itemId]: entry })
  },
  /** Clears the entry, only if it still holds `quantity` when one is given (a newer change wins). */
  clear(itemId: string, quantity?: number) {
    const all = pendingQuantities.all()
    if (!all[itemId] || (quantity !== undefined && all[itemId].quantity !== quantity)) return
    delete all[itemId]
    session.set(storageKeys.cartPending, all)
  },
}
