import { http, HttpResponse } from 'msw'
import { loginInput, registerInput, type Session } from '@/shared/contracts'
import { db, hashPassword, nextId, persist, publicUser, randomToken, type UserRecord } from '../db/store'
import { SESSION_TTL_MS, SHORT_SESSION_TTL_MS } from '../domain'
import { API, apiError, authenticate, bearer, fieldErrorsFrom, readJson, simulateNetwork } from '../http'
import { has } from '../scenarios'

function issueSession(user: UserRecord): Session {
  const ttl = has('session-expired') ? SHORT_SESSION_TTL_MS : SESSION_TTL_MS
  const session = {
    token: randomToken('sess'),
    userId: user.id,
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  }
  const state = db()
  state.sessions.push(session)
  persist()
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) }
}

export const authHandlers = [
  http.post(`${API}/auth/register`, async ({ request }) => {
    const failure = await simulateNetwork('auth')
    if (failure) return failure
    const parsed = registerInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const { name, username, email, password } = parsed.data
    const state = db()
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
        fieldErrors: { email: 'Este e-mail já está cadastrado.' },
      })
    }
    if (state.users.some((u) => u.username === username)) {
      return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fieldErrors: { username: 'Este nome de usuário já está em uso.' },
      })
    }
    const salt = randomToken('salt')
    const user: UserRecord = {
      id: nextId('user'),
      email,
      name,
      username,
      ensName: null,
      walletNickname: null,
      avatarUrl: null,
      salt,
      passwordHash: await hashPassword(password, salt),
    }
    state.users.push(user)
    persist()
    return HttpResponse.json(issueSession(user), { status: 201 })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const failure = await simulateNetwork('auth')
    if (failure) return failure
    const parsed = loginInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const user = db().users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
    const hash = user ? await hashPassword(parsed.data.password, user.salt) : null
    if (!user || hash !== user.passwordHash) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json(issueSession(user))
  }),

  http.get(`${API}/auth/session`, async ({ request }) => {
    const failure = await simulateNetwork('auth')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const session = db().sessions.find((s) => s.token === auth.token)!
    return HttpResponse.json({ token: auth.token, expiresAt: session.expiresAt, user: publicUser(auth.user) })
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    await simulateNetwork('auth')
    const token = bearer(request)
    const state = db()
    state.sessions = state.sessions.filter((s) => s.token !== token)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
