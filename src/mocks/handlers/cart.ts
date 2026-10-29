import { http, HttpResponse } from 'msw'
import { addCartItemInput } from '@/shared/contracts'
import { z } from 'zod'
import { db, nextId, persist, type CartRecord } from '../db/store'
import {
  cartView,
  checkCoupon,
  checkQuantity,
  findCartForUser,
  findGuestCart,
  findNft,
  mergeCarts,
  touchCart,
} from '../domain'
import { API, apiError, authenticate, bearer, fieldErrorsFrom, readJson, simulateNetwork } from '../http'
import { has } from '../scenarios'

export const CART_HEADER = 'x-cart-id'

/**
 * Authenticated requests always use the user's cart. A request carrying an
 * invalid/expired token gets a 401 instead of silently falling back to a
 * guest cart, so the client can handle the expired session.
 */
export function resolveCart(request: Request): { cart: CartRecord } | { response: Response } {
  if (bearer(request)) {
    const auth = authenticate(request)
    if ('response' in auth) return auth
    return { cart: findCartForUser(auth.user.id) }
  }
  return { cart: findGuestCart(request.headers.get(CART_HEADER)) }
}

function respond(cart: CartRecord, status = 200) {
  return HttpResponse.json(cartView(cart), {
    status,
    headers: cart.ownerId ? {} : { 'X-Cart-Id': cart.id },
  })
}

export const cartHandlers = [
  // ---------- Favorites (private) ----------
  http.get(`${API}/me/favorites`, async ({ request }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    return HttpResponse.json({ nftIds: db().favorites[auth.user.id] ?? [] })
  }),

  http.put(`${API}/me/favorites/:nftId`, async ({ request, params }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    if (has('favorites-error')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível salvar o favorito.')
    const nftId = String(params.nftId)
    if (!findNft(nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const state = db()
    const list = (state.favorites[auth.user.id] ??= [])
    if (!list.includes(nftId)) list.push(nftId)
    persist()
    return HttpResponse.json({ nftIds: list })
  }),

  http.delete(`${API}/me/favorites/:nftId`, async ({ request, params }) => {
    const failure = await simulateNetwork('favorites')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    if (has('favorites-error')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível remover o favorito.')
    const state = db()
    state.favorites[auth.user.id] = (state.favorites[auth.user.id] ?? []).filter((id) => id !== params.nftId)
    persist()
    return HttpResponse.json({ nftIds: state.favorites[auth.user.id] })
  }),

  // ---------- Cart ----------
  http.get(`${API}/cart`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    return respond(result.cart)
  }),

  http.post(`${API}/cart/items`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    const parsed = addCartItemInput.safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Dados inválidos.', { fieldErrors: fieldErrorsFrom(parsed.error.issues) })
    }
    const { cart } = result
    const { nftId, editionId, quantity } = parsed.data
    const existing = cart.items.find((i) => i.editionId === editionId)
    const nextQuantity = (existing?.quantity ?? 0) + quantity
    const error = checkQuantity(nftId, editionId, nextQuantity)
    if (error) {
      return apiError(error.code === 'NOT_FOUND' ? 404 : 409, error.code, error.message)
    }
    const price = findNft(nftId)!.editions.find((e) => e.id === editionId)!.priceEth
    if (existing) {
      existing.quantity = nextQuantity
      existing.addedPriceEth = price
    } else {
      cart.items.push({ id: nextId('item'), nftId, editionId, quantity, addedPriceEth: price })
    }
    touchCart(cart)
    return respond(cart, 201)
  }),

  http.patch(`${API}/cart/items/:itemId`, async ({ request, params }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    const parsed = z.object({ quantity: z.number().int().positive() }).safeParse(await readJson(request))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.')
    const { cart } = result
    const item = cart.items.find((i) => i.id === params.itemId)
    if (!item) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const error = checkQuantity(item.nftId, item.editionId, parsed.data.quantity)
    // Decreasing is always allowed, even if stock dropped below the current quantity.
    if (error && parsed.data.quantity > item.quantity) {
      return apiError(error.code === 'NOT_FOUND' ? 404 : 409, error.code, error.message)
    }
    item.quantity = parsed.data.quantity
    touchCart(cart)
    return respond(cart)
  }),

  http.delete(`${API}/cart/items/:itemId`, async ({ request, params }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    const { cart } = result
    cart.items = cart.items.filter((i) => i.id !== params.itemId)
    touchCart(cart)
    return respond(cart)
  }),

  /** Buyer accepts the current prices of items whose price changed. */
  http.post(`${API}/cart/acknowledge-prices`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    const { cart } = result
    for (const item of cart.items) {
      const edition = findNft(item.nftId)?.editions.find((e) => e.id === item.editionId)
      if (edition) item.addedPriceEth = edition.priceEth
    }
    touchCart(cart)
    return respond(cart)
  }),

  http.put(`${API}/cart/coupon`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    const parsed = z.object({ code: z.string().trim().min(1) }).safeParse(await readJson(request))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Informe um código.', { fieldErrors: { code: 'Informe um código.' } })
    }
    const check = checkCoupon(parsed.data.code)
    if (!check.ok) return apiError(422, check.code, check.message, { fieldErrors: { code: check.message } })
    result.cart.couponCode = check.code
    touchCart(result.cart)
    return respond(result.cart)
  }),

  http.delete(`${API}/cart/coupon`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const result = resolveCart(request)
    if ('response' in result) return result.response
    result.cart.couponCode = null
    touchCart(result.cart)
    return respond(result.cart)
  }),

  /** Called right after login: moves the guest cart into the user's cart. */
  http.post(`${API}/cart/merge`, async ({ request }) => {
    const failure = await simulateNetwork('cart')
    if (failure) return failure
    const auth = authenticate(request)
    if ('response' in auth) return auth.response
    const parsed = z.object({ guestCartId: z.string() }).safeParse(await readJson(request))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'guestCartId obrigatório.')
    const target = findCartForUser(auth.user.id)
    const guest = db().carts[parsed.data.guestCartId]
    if (guest && guest.ownerId === null) mergeCarts(guest, target)
    return respond(target)
  }),
]
