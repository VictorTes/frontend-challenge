/**
 * A checkout attempt = one idempotency key bound to one exact payload.
 *
 * - Repeated clicks and retries after a timeout reuse the key, so the server
 *   returns the same order instead of creating another.
 * - A different payload (e.g. after a re-quote) gets a new key.
 * - Persisted per user, so a refresh mid-payment recovers the pending order.
 */
import type { CreateOrderInput } from '@/shared/contracts'
import { local, storageKeys } from '@/shared/lib/storage'

export type CheckoutAttempt = {
  key: string
  payload: CreateOrderInput
  payloadHash: string
  orderId: string | null
  createdAt: string
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export const orderAttempts = {
  get(userId: string): CheckoutAttempt | null {
    return local.get<CheckoutAttempt>(storageKeys.checkoutAttempt(userId))
  },

  /** Returns the attempt for this payload, reusing the key when it matches. */
  forPayload(userId: string, payload: CreateOrderInput): CheckoutAttempt {
    const payloadHash = canonical(payload)
    const existing = this.get(userId)
    if (existing && existing.payloadHash === payloadHash) return existing
    const attempt: CheckoutAttempt = {
      key: crypto.randomUUID(),
      payload,
      payloadHash,
      orderId: null,
      createdAt: new Date().toISOString(),
    }
    local.set(storageKeys.checkoutAttempt(userId), attempt)
    return attempt
  },

  setOrder(userId: string, orderId: string) {
    const existing = this.get(userId)
    if (existing) local.set(storageKeys.checkoutAttempt(userId), { ...existing, orderId })
  },

  clear(userId: string) {
    local.remove(storageKeys.checkoutAttempt(userId))
  },
}
