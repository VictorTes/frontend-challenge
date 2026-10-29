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

export async function startMocks(): Promise<void> {
  await initDb()
  loadScenarios()
  // Orders left pending by a previous page load settle (or resume their timer).
  settleOverdueOrders()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
