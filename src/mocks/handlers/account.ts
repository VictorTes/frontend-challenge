import { http, HttpResponse } from 'msw'
import { avatarInput, passwordChangeInput, profileInput, walletInput, type Wallet } from '@/shared/contracts'
import { db, hashPassword, nextId, persist, publicUser, randomToken, type WalletRecord } from '../db/store'
import { API, apiError, authenticate, fieldErrorsFrom, readJson, simulateNetwork } from '../http'

function publicWallet(record: WalletRecord): Wallet {
  const { userId: _u, ...wallet } = record
  return wallet
}

export const accountHandlers = [
  http.get(`${API}/me/profile`, async ({ request }) => {
    const failure = await simulateNetwork('profile')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    return HttpResponse.json(publicUser(auth.user))
  }),

  http.patch(`${API}/me/profile`, async ({ request }) => {
    const failure = await simulateNetwork('profile')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const parsed = profileInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const { name, username, email, ensName, walletNickname } = parsed.data
    const others = db().users.filter((u) => u.id !== auth.user.id)
    if (others.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso.', { fieldErrors: { email: 'Este e-mail já está em uso.' } })
    }
    if (others.some((u) => u.username === username)) {
      return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fieldErrors: { username: 'Este nome de usuário já está em uso.' },
      })
    }
    Object.assign(auth.user, { name, username, email, ensName: ensName || null, walletNickname })
    persist()
    return HttpResponse.json(publicUser(auth.user))
  }),

  http.put(`${API}/me/avatar`, async ({ request }) => {
    const failure = await simulateNetwork('profile')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const parsed = avatarInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Imagem inválida.', {
        fieldErrors: { avatar: parsed.error.issues[0]?.message ?? 'Imagem inválida.' },
      })
    }
    auth.user.avatarUrl = parsed.data.dataUrl
    persist()
    return HttpResponse.json(publicUser(auth.user))
  }),

  http.post(`${API}/me/password`, async ({ request }) => {
    const failure = await simulateNetwork('profile')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const parsed = passwordChangeInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const { currentPassword, newPassword } = parsed.data
    if ((await hashPassword(currentPassword, auth.user.salt)) !== auth.user.passwordHash) {
      return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', {
        fieldErrors: { currentPassword: 'Senha atual incorreta.' },
      })
    }
    if (currentPassword === newPassword) {
      return apiError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', {
        fieldErrors: { newPassword: 'A nova senha deve ser diferente da atual.' },
      })
    }
    auth.user.salt = randomToken('salt')
    auth.user.passwordHash = await hashPassword(newPassword, auth.user.salt)
    // Other sessions of this user are revoked; the current one stays valid.
    db().sessions = db().sessions.filter((s) => s.userId !== auth.user.id || s.token === auth.token)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Wallets ----------
  http.get(`${API}/me/wallets`, async ({ request }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const items = db()
      .wallets.filter((w) => w.userId === auth.user.id)
      .sort((a, b) => a.slot.localeCompare(b.slot))
      .map(publicWallet)
    return HttpResponse.json({ items })
  }),

  http.post(`${API}/me/wallets`, async ({ request }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const parsed = walletInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const state = db()
    if (state.wallets.some((w) => w.userId === auth.user.id && w.slot === parsed.data.slot)) {
      return apiError(409, 'VALIDATION_ERROR', 'Já existe uma carteira neste espaço. Edite a existente.', {
        fieldErrors: { slot: 'Já existe uma carteira neste espaço.' },
      })
    }
    const duplicate = state.wallets.find(
      (w) => w.userId === auth.user.id && w.address.toLowerCase() === parsed.data.address.toLowerCase(),
    )
    if (duplicate) {
      return apiError(409, 'VALIDATION_ERROR', 'Este endereço já está cadastrado.', {
        fieldErrors: { address: 'Este endereço já está cadastrado em outra carteira.' },
      })
    }
    const record: WalletRecord = {
      ...parsed.data,
      id: nextId('wallet'),
      userId: auth.user.id,
      updatedAt: new Date().toISOString(),
    }
    state.wallets.push(record)
    persist()
    return HttpResponse.json(publicWallet(record), { status: 201 })
  }),

  http.put(`${API}/me/wallets/:walletId`, async ({ request, params }) => {
    const failure = await simulateNetwork('wallets')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const state = db()
    const record = state.wallets.find((w) => w.id === params.walletId)
    if (!record) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (record.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Esta carteira não pertence a você.')
    const parsed = walletInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const duplicate = state.wallets.find(
      (w) =>
        w.userId === auth.user.id &&
        w.id !== record.id &&
        w.address.toLowerCase() === parsed.data.address.toLowerCase(),
    )
    if (duplicate) {
      return apiError(409, 'VALIDATION_ERROR', 'Este endereço já está cadastrado.', {
        fieldErrors: { address: 'Este endereço já está cadastrado em outra carteira.' },
      })
    }
    Object.assign(record, parsed.data, { slot: record.slot, updatedAt: new Date().toISOString() })
    persist()
    return HttpResponse.json(publicWallet(record))
  }),
]
