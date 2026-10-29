/**
 * Session state outside React so the Axios interceptors, the router guards
 * and the socket can read it synchronously. Components subscribe with
 * `useSession()` (useSyncExternalStore).
 */
import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/shared/contracts'
import { local, storageKeys } from '@/shared/lib/storage'

export type SessionEndReason = 'logout' | 'expired'

type Listener = () => void
type EndListener = (previous: Session, reason: SessionEndReason) => void

let current: Session | null = local.get<Session>(storageKeys.session)
const listeners = new Set<Listener>()
const endListeners = new Set<EndListener>()

function emit() {
  for (const l of listeners) l()
}

export const sessionStore = {
  get: () => current,
  token: () => current?.token ?? null,
  userId: () => current?.user.id ?? null,

  start(next: Session) {
    current = next
    local.set(storageKeys.session, next)
    emit()
  },

  updateUser(user: User) {
    if (!current) return
    current = { ...current, user }
    local.set(storageKeys.session, current)
    emit()
  },

  /** Ends the session; listeners clear private caches and subscriptions. */
  end(reason: SessionEndReason) {
    const previous = current
    if (!previous) return
    current = null
    local.remove(storageKeys.session)
    for (const l of endListeners) l(previous, reason)
    emit()
  },

  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },

  onEnd(listener: EndListener) {
    endListeners.add(listener)
    return () => void endListeners.delete(listener)
  },
}

// Another tab logging in/out keeps this tab consistent.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKeys.session) return
    const next = local.get<Session>(storageKeys.session)
    if (!next && current) sessionStore.end('logout')
    else if (next && next.token !== current?.token) sessionStore.start(next)
  })
}

export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}
