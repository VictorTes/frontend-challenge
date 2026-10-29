import { setupWorker } from 'msw/browser'
import { initDb } from './db/store'
import { settleOverdueOrders } from './domain'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { checkoutHandlers } from './handlers/checkout'
import { controlHandlers } from './handlers/control'
import { realtimeHandlers } from './realtime'
import { loadScenarios } from './scenarios'

export const handlers = [
  ...controlHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...checkoutHandlers,
  ...accountHandlers,
  ...realtimeHandlers,
]

/**
 * `kurioMock` in the browser console drives the *simulated server* (the same
 * control API the E2E tests use); the app only sees the effects via REST and
 * Socket.IO. Example: kurioMock.setPrice('emerald-ape-042', 'emerald-ape-042-1of50', '1.5')
 */
function exposeConsoleHelpers() {
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`/api/__mock${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => r.json())
  Object.assign(window, {
    kurioMock: {
      state: () => call('GET', '/state'),
      scenario: (scenario: string) => call('PUT', '/scenario', { scenario }),
      reset: (scenario = 'default') => call('POST', '/reset', { scenario }),
      setPrice: (nftId: string, editionId: string, priceEth: string) =>
        call('POST', `/nfts/${nftId}/editions/${editionId}`, { priceEth }),
      setStock: (nftId: string, editionId: string, available: number) =>
        call('POST', `/nfts/${nftId}/editions/${editionId}`, { available }),
      events: () => call('GET', '/realtime/events'),
      replay: (eventId: string) => call('POST', '/realtime/replay', { eventId }),
      dropSockets: (block = false) => call('POST', '/realtime/disconnect', { block }),
      restoreSockets: () => call('POST', '/realtime/restore'),
      expireSessions: () => call('POST', '/sessions/expire'),
      settleOrder: (orderId: string) => call('POST', `/orders/${orderId}/settle`),
    },
  })
}

export async function startMocks(): Promise<void> {
  await initDb()
  loadScenarios()
  // Orders left pending by a previous page load settle (or resume their timer).
  settleOverdueOrders()
  exposeConsoleHelpers()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
