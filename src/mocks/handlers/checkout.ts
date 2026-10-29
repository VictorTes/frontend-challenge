import { delay, http, HttpResponse } from 'msw'
import { connectWalletInput, createOrderInput, quoteInput, type WalletConnection } from '@/shared/contracts'
import { db, nextId, persist, type OrderRecord } from '../db/store'
import {
  applyCheckoutScenarios,
  createQuote,
  findCartForUser,
  reserveStock,
  revalidateQuote,
  scheduleSettlement,
  settleDelay,
  settleOverdueOrders,
} from '../domain'
import { toPublicOrder } from '../realtime'
import { resolveCart } from './cart'
import { API, apiError, authenticate, fieldErrorsFrom, readJson, simulateNetwork } from '../http'
import { has, hit } from '../scenarios'

/** Canonical JSON (sorted keys) so the same payload always hashes the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/** Long enough to exceed the client's request timeout. */
const ORDER_TIMEOUT_DELAY_MS = 30_000

export const checkoutHandlers = [
  http.post(`${API}/quotes`, async ({ request }) => {
    const failure = await simulateNetwork('quote')
    if (failure) return failure
    // Guests get quotes for their cart summary; only a user's quote can become an order.
    const resolved = resolveCart(request)
    if ('response' in resolved) return resolved.response
    const parsed = quoteInput.safeParse(await readJson(request))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Rede inválida.')
    const quote = createQuote(resolved.cart, parsed.data.network, resolved.cart.ownerId)
    const { cartId: _c, userId: _u, usedByOrderId: _o, ...publicQuote } = quote
    return HttpResponse.json(publicQuote, { status: 201 })
  }),

  // ---------- Simulated wallet connection ----------
  http.post(`${API}/wallets/:walletId/connect`, async ({ request, params }) => {
    const failure = await simulateNetwork('wallet')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const wallet = db().wallets.find((w) => w.id === params.walletId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Esta carteira não pertence a você.')
    const parsed = connectWalletInput.safeParse(await readJson(request))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Selecione carteira e rede.')
    // Simulates the user approving in the wallet extension.
    await delay(600)
    if (has('wallet-rejected')) {
      return apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }
    db().connections[`${auth.user.id}:${wallet.id}`] = parsed.data
    persist()
    const body: WalletConnection = { walletId: wallet.id, ...parsed.data, status: 'connected' }
    return HttpResponse.json(body)
  }),

  http.post(`${API}/wallets/:walletId/disconnect`, async ({ request, params }) => {
    const failure = await simulateNetwork('wallet')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const key = `${auth.user.id}:${String(params.walletId)}`
    const previous = db().connections[key]
    delete db().connections[key]
    persist()
    const body: WalletConnection = {
      walletId: String(params.walletId),
      provider: previous?.provider ?? 'metamask',
      network: previous?.network ?? 'ethereum',
      status: 'disconnected',
    }
    return HttpResponse.json(body)
  }),

  // ---------- Orders ----------
  http.post(`${API}/orders`, async ({ request }) => {
    const failure = await simulateNetwork('orders')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) {
      return apiError(400, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
    }
    const raw = await readJson(request)
    const parsed = createOrderInput.safeParse(raw)
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os dados do pedido.', {
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      })
    }
    const state = db()
    const requestHash = canonical(parsed.data)

    // Idempotency: same key → same order; same key + different body → conflict.
    const existing = state.orders.find((o) => o.idempotencyKey === key && o.userId === auth.user.id)
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro pedido.')
      }
      settleOverdueOrders()
      return HttpResponse.json(toPublicOrder(existing), { status: 200 })
    }

    const input = parsed.data
    const quote = state.quotes[input.quoteId]
    if (!quote || quote.userId !== auth.user.id) {
      return apiError(409, 'QUOTE_STALE', 'A cotação não é mais válida. Revise o pedido.', { details: { quote: null } })
    }
    if (quote.usedByOrderId) {
      return apiError(409, 'QUOTE_STALE', 'Esta cotação já foi usada em outro pedido.', { details: { quote: null } })
    }
    const wallet = state.wallets.find((w) => w.id === input.walletId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Esta carteira não pertence a você.')
    if (!state.connections[`${auth.user.id}:${wallet.id}`]) {
      return apiError(409, 'WALLET_REJECTED', 'Conecte a carteira antes de confirmar a compra.')
    }

    applyCheckoutScenarios(quote)
    const cart = findCartForUser(auth.user.id)
    const validation = revalidateQuote(quote, cart)
    if (!validation.ok) {
      const { cartId: _c, userId: _u, usedByOrderId: _o, ...fresh } = validation.fresh
      return apiError(
        409,
        validation.reason === 'stale' ? 'QUOTE_STALE' : 'OUT_OF_STOCK',
        validation.reason === 'stale'
          ? 'Preço, disponibilidade, cupom ou taxas mudaram. Revise e confirme novamente.'
          : 'Alguns itens não estão mais disponíveis na quantidade solicitada.',
        { details: { quote: fresh } },
      )
    }

    const now = new Date().toISOString()
    const order: OrderRecord = {
      id: nextId('order'),
      status: 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
      network: input.network,
      wallet: { id: wallet.id, nickname: wallet.nickname, address: wallet.address, provider: input.provider },
      buyer: input.buyer,
      // Snapshot: the receipt never reads the live catalog.
      lines: structuredClone(quote.lines),
      coupon: quote.coupon,
      subtotalEth: quote.subtotalEth,
      discountEth: quote.discountEth,
      networkFeeEth: quote.networkFeeEth,
      totalEth: quote.totalEth,
      txHash: null,
      explorerUrl: null,
      declineReason: null,
      userId: auth.user.id,
      cartId: cart.id,
      idempotencyKey: key,
      requestHash,
      settleAt: Date.now() + settleDelay(),
      outcome: has('payment-declined') ? 'declined' : 'confirmed',
    }
    quote.usedByOrderId = order.id
    state.orders.push(order)
    persist()
    reserveStock(quote)
    scheduleSettlement(order)

    // The order exists, but the response is lost to a client-side timeout.
    if (has('order-timeout') && hit('orders:timeout') === 1) {
      await delay(ORDER_TIMEOUT_DELAY_MS)
    }
    return HttpResponse.json(toPublicOrder(order), { status: 201 })
  }),

  http.get(`${API}/orders/:orderId`, async ({ request, params }) => {
    const failure = await simulateNetwork('orders')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    settleOverdueOrders()
    const order = db().orders.find((o) => o.id === params.orderId)
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Você não tem acesso a este pedido.')
    return HttpResponse.json(toPublicOrder(order))
  }),

  http.get(`${API}/orders`, async ({ request }) => {
    const failure = await simulateNetwork('orders')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    settleOverdueOrders()
    const status = new URL(request.url).searchParams.get('status')
    const items = db()
      .orders.filter((o) => o.userId === auth.user.id && (!status || o.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicOrder)
    return HttpResponse.json({ items })
  }),
]
