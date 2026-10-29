/** localStorage/sessionStorage wrappers that never throw (private mode, quota). */
function safe(area: () => Storage) {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = area().getItem(key)
        return raw === null ? null : (JSON.parse(raw) as T)
      } catch {
        return null
      }
    },
    set(key: string, value: unknown) {
      try {
        area().setItem(key, JSON.stringify(value))
      } catch {
        // ignore
      }
    },
    remove(key: string) {
      try {
        area().removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}

export const local = safe(() => localStorage)
export const session = safe(() => sessionStorage)

export const storageKeys = {
  session: 'kurio:session',
  guestCart: 'kurio:guest-cart',
  /** Per user: in-flight checkout attempt (idempotency key + payload hash + order id). */
  checkoutAttempt: (userId: string) => `kurio:checkout-attempt:${userId}`,
  /** Per user: form draft kept when the session expires mid-checkout. */
  checkoutDraft: (userId: string) => `kurio:checkout-draft:${userId}`,
  /** Cart quantity changes not yet confirmed by the server (survive a reload; per tab). */
  cartPending: 'kurio:cart-pending',
}
