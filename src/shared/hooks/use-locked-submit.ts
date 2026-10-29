import { useRef } from 'react'

/**
 * Synchronous lock for one async action at a time. `disabled={mutation.isPending}`
 * alone is not enough: TanStack Query publishes the pending state on the next
 * tick, so a double click or a repeated Enter would fire the action twice
 * (e.g. adding the same NFT to the cart twice).
 */
export function useSingleFlight() {
  const running = useRef(false)
  return async (task: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true
    try {
      await task()
    } finally {
      running.current = false
    }
  }
}

/** Form submit handler guarded by `useSingleFlight` (also prevents the native submit). */
export function useLockedSubmit<E extends { preventDefault(): void }>(handler: (event: E) => Promise<void>) {
  const exclusive = useSingleFlight()
  return (event: E) => {
    event.preventDefault()
    return exclusive(() => handler(event))
  }
}
