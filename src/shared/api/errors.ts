import axios from 'axios'
import { apiErrorBody, type ApiErrorCode } from '@/shared/contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'contract'

/** Normalized error for every REST failure: HTTP, network, timeout or contract drift. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | null
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ApiErrorCode | null
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
  }

  /** Worth retrying automatically: connectivity or 5xx. */
  get isTransient() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500)
  }

  get isAuthError() {
    return this.status === 401
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error
    if (axios.isCancel(error)) return new ApiError({ kind: 'canceled', message: 'Requisição cancelada.' })
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder.' })
      }
      if (!error.response) {
        return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor. Verifique sua rede.' })
      }
      const parsed = apiErrorBody.safeParse(error.response.data)
      if (parsed.success) {
        const { code, message, fieldErrors, details } = parsed.data.error
        return new ApiError({ kind: 'http', status: error.response.status, code, message, fieldErrors, details })
      }
      return new ApiError({
        kind: 'http',
        status: error.response.status,
        message: `Erro inesperado (HTTP ${error.response.status}).`,
      })
    }
    return new ApiError({ kind: 'contract', message: error instanceof Error ? error.message : 'Erro inesperado.' })
  }
}

export function errorMessage(error: unknown): string {
  return ApiError.from(error).message
}
