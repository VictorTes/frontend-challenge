/**
 * Named, composable mock scenarios. Select with `?scenario=slow,payment-declined`
 * (persisted in localStorage) or via the mock control API. Deterministic: no
 * Math.random — "variable latency" follows a fixed sequence.
 */
export const scenarioNames = [
  'default',
  'empty',
  'slow',
  'variable-latency',
  'out-of-order',
  'offline',
  'server-error',
  'flaky',
  'favorites-error',
  'session-expired',
  'price-change-on-checkout',
  'sold-out-on-checkout',
  'order-timeout',
  'payment-declined',
  'payment-slow',
  'wallet-rejected',
] as const
export type ScenarioName = (typeof scenarioNames)[number]

export const scenarioDescriptions: Record<ScenarioName, string> = {
  default: 'Happy path with small, fixed latency',
  empty: 'Catalog search always returns no results',
  slow: 'Every request takes 2.5s (skeletons)',
  'variable-latency': 'Latency cycles 100ms → 1.2s → 400ms',
  'out-of-order': 'Earlier catalog requests resolve after later ones',
  offline: 'Every API request fails with a network error',
  'server-error': 'Catalog and NFT detail return HTTP 500',
  flaky: 'First 2 catalog/detail requests fail with 503, then recover',
  'favorites-error': 'Favorite mutations fail with HTTP 500',
  'session-expired': 'Sessions expire 30s after login',
  'price-change-on-checkout': 'Price of the first item rises when the order is submitted',
  'sold-out-on-checkout': 'First item sells out when the order is submitted',
  'order-timeout': 'First order request is created but the response never arrives in time',
  'payment-declined': 'Payments are declined by the simulated wallet',
  'payment-slow': 'Payment stays pending for 20s',
  'wallet-rejected': 'Wallet connection request is rejected by the user',
}

const STORAGE_KEY = 'nft-mock:scenario'

let active = new Set<ScenarioName>(['default'])
const counters = new Map<string, number>()

export function parseScenarios(raw: string | null | undefined): Set<ScenarioName> {
  const names = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ScenarioName => (scenarioNames as readonly string[]).includes(s))
  return new Set(names.length ? names : ['default'])
}

export function loadScenarios(): void {
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  if (fromUrl) {
    setScenarios(parseScenarios(fromUrl))
    return
  }
  try {
    active = parseScenarios(localStorage.getItem(STORAGE_KEY))
  } catch {
    active = new Set(['default'])
  }
}

export function setScenarios(next: Set<ScenarioName>): void {
  active = next
  counters.clear()
  try {
    localStorage.setItem(STORAGE_KEY, [...next].join(','))
  } catch {
    // ignore
  }
}

export function activeScenarios(): ScenarioName[] {
  return [...active]
}

export function has(name: ScenarioName): boolean {
  return active.has(name)
}

/** Per-key call counter, reset when the scenario changes. */
export function hit(key: string): number {
  const n = (counters.get(key) ?? 0) + 1
  counters.set(key, n)
  return n
}
