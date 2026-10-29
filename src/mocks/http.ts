import { delay, HttpResponse } from 'msw'
import type { ApiErrorCode } from '@/shared/contracts'
import { db, persist, publicUser, type UserRecord } from './db/store'
import { has, hit } from './scenarios'

export const API = `${import.meta.env.VITE_API_URL ?? '/api'}`

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown } = {},
) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

const VARIABLE_SEQUENCE = [100, 1200, 400]

/** Base latency for a request under the active scenarios. */
function latencyFor(routeKey: string): number {
  if (has('slow')) return 2500
  if (has('variable-latency')) {
    const n = hit(`latency:${routeKey}`)
    return VARIABLE_SEQUENCE[(n - 1) % VARIABLE_SEQUENCE.length] ?? 100
  }
  if (has('out-of-order') && routeKey === 'catalog') {
    // Odd requests are slow, even requests fast: a later request resolves first.
    return hit('ooo:catalog') % 2 === 1 ? 1500 : 150
  }
  return 120
}

const FAILING_ROUTES = new Set(['catalog', 'nft-detail'])

/**
 * Applies network conditions. Returns a Response to short-circuit the handler
 * (network error / 5xx), or undefined to continue.
 */
export async function simulateNetwork(routeKey: string): Promise<Response | undefined> {
  if (has('offline')) {
    await delay(150)
    return HttpResponse.error()
  }
  await delay(latencyFor(routeKey))
  if (has('server-error') && FAILING_ROUTES.has(routeKey)) {
    return apiError(500, 'INTERNAL_ERROR', 'O servidor falhou ao processar a requisição.')
  }
  if (has('flaky') && FAILING_ROUTES.has(routeKey) && hit(`flaky:${routeKey}`) <= 2) {
    return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
  }
  return undefined
}

export function bearer(request: Request): string | null {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export type AuthResult = { user: UserRecord; token: string } | { response: Response }

/** Resolves the session user or a 401 (missing/invalid vs expired). */
export function authenticate(request: Request): AuthResult {
  const token = bearer(request)
  if (!token) return { response: apiError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.') }
  const state = db()
  const session = state.sessions.find((s) => s.token === token)
  if (!session) {
    return { response: apiError(401, 'UNAUTHENTICATED', 'Sua sessão não é mais válida. Entre novamente.') }
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    state.sessions = state.sessions.filter((s) => s.token !== token)
    persist()
    return { response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  const user = state.users.find((u) => u.id === session.userId)
  if (!user) return { response: apiError(401, 'UNAUTHENTICATED', 'Conta não encontrada.') }
  return { user, token }
}

/** Optional auth: a bad token on a public route is treated as anonymous. */
export function optionalUser(request: Request): UserRecord | null {
  const result = authenticate(request)
  return 'user' in result ? result.user : null
}

export { publicUser }

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}
