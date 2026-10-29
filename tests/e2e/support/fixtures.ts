import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  alice: { email: 'alice@kurio.test', password: 'Kurio@2026', username: 'alice' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio@2026', username: 'bruno' },
} as const

/** Known NFT ids from the deterministic seed. */
export const NFT = {
  emerald: { id: 'emerald-ape-042', name: 'Emerald Ape #042', edition1of50: 'emerald-ape-042-1of50' },
  sage: { id: 'sage-nomad-009', name: 'Sage Nomad #009', edition1of50: 'sage-nomad-009-1of50' },
}

/**
 * Talks to the simulated backend's control API from inside the page, so the
 * request goes through the same MSW worker as the app. It changes server
 * state only; the UI learns about it through REST/Socket.IO.
 */
export class MockControl {
  constructor(private readonly page: Page) {}

  private async call<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
    return this.page.evaluate(
      async ({ method, path, body, auth }) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (auth) {
          const session = JSON.parse(localStorage.getItem('kurio:session') ?? 'null')
          if (session) headers.Authorization = `Bearer ${session.token}`
        }
        const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
        const text = await res.text()
        return (text ? JSON.parse(text) : null) as T
      },
      { method, path, body, auth },
    )
  }

  setEdition(nftId: string, editionId: string, change: { priceEth?: string; available?: number }) {
    return this.call<{ eventId: string }>('POST', `/__mock/nfts/${nftId}/editions/${editionId}`, change)
  }
  events() {
    return this.call<{ items: { id: string; type: string; version: number; resource: { id: string } }[] }>('GET', '/__mock/realtime/events')
  }
  replay(eventId: string) {
    return this.call('POST', '/__mock/realtime/replay', { eventId })
  }
  disconnectSockets(block = false) {
    return this.call('POST', '/__mock/realtime/disconnect', { block })
  }
  restoreSockets() {
    return this.call('POST', '/__mock/realtime/restore')
  }
  state() {
    return this.call<{ sockets: number; scenarios: string[] }>('GET', '/__mock/state')
  }
  expireSessions() {
    return this.call('POST', '/__mock/sessions/expire')
  }
  settleOrder(orderId: string) {
    return this.call('POST', `/__mock/orders/${orderId}/settle`)
  }
  setScenario(scenario: string) {
    return this.call('PUT', '/__mock/scenario', { scenario })
  }
  /** Orders of the signed-in user, via the real REST endpoint. */
  orders() {
    return this.call<{ items: { id: string; status: string }[] }>('GET', '/orders', undefined, true)
  }
}

type Fixtures = {
  mock: MockControl
  /** Opens a path with the given mock scenario(s) and waits for the app. */
  open: (path: string, scenario?: string) => Promise<void>
  login: (user: keyof typeof USERS, path?: string) => Promise<void>
}

export const test = base.extend<Fixtures>({
  mock: async ({ page }, use) => {
    await use(new MockControl(page))
  },
  open: async ({ page }, use) => {
    await use(async (path, scenario) => {
      const url = new URL(path, 'http://x')
      if (scenario) url.searchParams.set('scenario', scenario)
      await page.goto(url.pathname + url.search + url.hash)
      await expect(page.locator('#conteudo')).toBeAttached()
    })
  },
  login: async ({ page, open }, use) => {
    await use(async (user, path = '/') => {
      await open(`/login?redirect=${encodeURIComponent(path)}`)
      const { email, password } = USERS[user]
      await page.getByLabel('E-mail', { exact: true }).fill(email)
      await page.getByLabel('Senha', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === path.split('?')[0])
    })
  },
})

export { expect }

/** True below the md breakpoint (mobile layout: tab bar, sticky purchase bar). */
export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768
}

/** True below the lg breakpoint, where catalog filters live in a sheet. */
export function filtersInSheet(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 1024
}
