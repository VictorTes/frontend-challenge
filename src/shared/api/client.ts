import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { local, storageKeys } from '@/shared/lib/storage'
import { sessionStore } from '@/shared/session/session-store'
import { ApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.token()
  if (config.headers.has('Authorization')) return config
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else {
    const guestCart = local.get<string>(storageKeys.guestCart)
    if (guestCart) config.headers.set('X-Cart-Id', guestCart)
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    // The server assigns guest cart ids; remember them for the next requests.
    const cartId = response.headers['x-cart-id']
    if (typeof cartId === 'string' && !sessionStore.token()) local.set(storageKeys.guestCart, cartId)
    return response
  },
  (error) => {
    const apiError = ApiError.from(error)
    // Only end the session if the request was made with the *current* token:
    // a late 401 from a previous session must not log out the new user.
    const sentToken = String(axios.isAxiosError(error) ? (error.config?.headers?.get('Authorization') ?? '') : '').replace(
      'Bearer ',
      '',
    )
    if (apiError.isAuthError && sentToken && sentToken === sessionStore.token()) {
      sessionStore.end('expired')
    }
    return Promise.reject(apiError)
  },
)

/** Performs a request and validates the response body against its contract. */
export async function request<S extends z.ZodType>(
  schema: S,
  config: AxiosRequestConfig,
): Promise<z.infer<S>> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    throw new ApiError({
      kind: 'contract',
      message: `Resposta fora do contrato em ${config.url}: ${parsed.error.issues[0]?.message ?? ''}`,
    })
  }
  return parsed.data
}

export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
