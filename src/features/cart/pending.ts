import { session, storageKeys } from '@/shared/lib/storage'

type Entry = { owner: string | null; quantity: number }

/**
 * Set while the page unloads. A request still in flight then fails for reasons
 * that say nothing about the change (the mock layer lives in this page and the
 * request escapes to the real server), so its pending entry must survive for
 * the next page load instead of being cleared by that failure.
 */
let unloading = false
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => (unloading = true))
  window.addEventListener('beforeunload', () => (unloading = true))
}
export const isUnloading = () => unloading
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
