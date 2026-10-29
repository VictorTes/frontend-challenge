/**
 * Business rules of the simulated backend. Handlers stay thin: they parse the
 * request, call these functions and map results to HTTP responses.
 */
import type { Cart, NftDetail, Network, Quote, QuoteIssue, QuoteLine } from '@/shared/contracts'
import { addEth, compareEth, mulEth, percentOf, subEth } from '@/shared/lib/money'
import { NETWORK_FEES } from './db/seed'
import { db, nextId, persist, type CartRecord, type OrderRecord, type QuoteRecord } from './db/store'
import { emitNftUpdated, emitOrderUpdated } from './realtime'
import { has, hit } from './scenarios'

export const QUOTE_TTL_MS = 10 * 60_000
export const SESSION_TTL_MS = 2 * 60 * 60_000
export const SHORT_SESSION_TTL_MS = 30_000
const SETTLE_DELAY_MS = 2_500
const SLOW_SETTLE_DELAY_MS = 20_000

// ---------- NFTs ----------
export function findNft(id: string): NftDetail | undefined {
  return db().nfts.find((n) => n.id === id)
}

/** Recomputes the summary fields derived from editions. */
function refreshSummary(nft: NftDetail) {
  const inStock = nft.editions.filter((e) => e.available > 0)
  const pool = inStock.length ? inStock : nft.editions
  nft.priceEth = pool.reduce((min, e) => (compareEth(e.priceEth, min) < 0 ? e.priceEth : min), pool[0]!.priceEth)
  nft.available = nft.editions.reduce((sum, e) => sum + e.available, 0)
}

/**
 * Single entry point for catalog changes: bumps the resource version, persists
 * and emits `nft.updated`, so REST and realtime never disagree.
 */
export function updateEdition(
  nftId: string,
  editionId: string,
  change: { priceEth?: string; available?: number; availableDelta?: number },
): NftDetail | undefined {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return undefined
  if (change.priceEth !== undefined) edition.priceEth = change.priceEth
  if (change.available !== undefined) edition.available = Math.max(0, change.available)
  if (change.availableDelta !== undefined) {
    edition.available = Math.max(0, edition.available + change.availableDelta)
  }
  refreshSummary(nft)
  nft.version += 1
  persist()
  emitNftUpdated(nft)
  return nft
}

// ---------- Cart ----------
export function findCartForUser(userId: string): CartRecord {
  const state = db()
  const existing = Object.values(state.carts).find((c) => c.ownerId === userId)
  if (existing) return existing
  const cart: CartRecord = { id: nextId('cart'), ownerId: userId, items: [], couponCode: null, version: 1 }
  state.carts[cart.id] = cart
  persist()
  return cart
}

/** Guest carts are addressed by an opaque id; a user's cart is never reachable this way. */
export function findGuestCart(cartId: string | null): CartRecord {
  const state = db()
  const existing = cartId ? state.carts[cartId] : undefined
  if (existing && existing.ownerId === null) return existing
  const cart: CartRecord = { id: nextId('guest-cart'), ownerId: null, items: [], couponCode: null, version: 1 }
  state.carts[cart.id] = cart
  persist()
  return cart
}

export function touchCart(cart: CartRecord) {
  cart.version += 1
  persist()
}

export function cartView(cart: CartRecord): Cart {
  const items = cart.items.flatMap((item) => {
    const nft = findNft(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) return []
    return [
      {
        id: item.id,
        nftId: nft.id,
        editionId: edition.id,
        tokenId: nft.tokenId,
        nftName: nft.name,
        editionName: edition.name,
        imageUrl: nft.imageUrl,
        quantity: item.quantity,
        unitPriceEth: edition.priceEth,
        addedPriceEth: item.addedPriceEth,
        available: edition.available,
        maxPerOrder: edition.maxPerOrder,
      },
    ]
  })
  return { id: cart.id, items, couponCode: cart.couponCode, version: cart.version }
}

export type CartError = { code: 'NOT_FOUND' | 'OUT_OF_STOCK' | 'QUANTITY_LIMIT'; message: string }

/** Validates a desired quantity for an edition: stock and per-order limit. */
export function checkQuantity(nftId: string, editionId: string, quantity: number): CartError | null {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return { code: 'NOT_FOUND', message: 'NFT ou edição não encontrada.' }
  if (edition.available === 0) return { code: 'OUT_OF_STOCK', message: `A edição ${edition.name} está esgotada.` }
  if (quantity > edition.available) {
    return {
      code: 'OUT_OF_STOCK',
      message: `Apenas ${edition.available} unidade(s) disponível(is) da edição ${edition.name}.`,
    }
  }
  if (quantity > edition.maxPerOrder) {
    return { code: 'QUANTITY_LIMIT', message: `Limite de ${edition.maxPerOrder} por pedido para a edição ${edition.name}.` }
  }
  return null
}

/** Moves guest items into the user's cart, capping at stock/limits. */
export function mergeCarts(guest: CartRecord, target: CartRecord) {
  if (guest.id === target.id) return
  for (const item of guest.items) {
    const existing = target.items.find((i) => i.editionId === item.editionId)
    const nft = findNft(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const cap = Math.min(edition.available, edition.maxPerOrder)
    if (existing) {
      existing.quantity = Math.max(1, Math.min(cap, existing.quantity + item.quantity))
    } else if (cap > 0) {
      target.items.push({ ...item, id: nextId('item'), quantity: Math.min(cap, item.quantity) })
    }
  }
  target.couponCode ??= guest.couponCode
  delete db().carts[guest.id]
  touchCart(target)
}

// ---------- Coupons ----------
export type CouponCheck =
  | { ok: true; code: string; percentOff: number }
  | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED'; message: string }

export function checkCoupon(raw: string): CouponCheck {
  const code = raw.trim().toUpperCase()
  const coupon = db().coupons.find((c) => c.code === code)
  if (!coupon) return { ok: false, code: 'COUPON_INVALID', message: 'Código promocional inválido.' }
  if (Date.parse(coupon.expiresAt) <= Date.now()) {
    return { ok: false, code: 'COUPON_EXPIRED', message: 'Este código promocional expirou.' }
  }
  return { ok: true, code: coupon.code, percentOff: coupon.percentOff }
}

// ---------- Quote ----------
function buildQuote(cart: CartRecord, network: Network): Omit<Quote, 'id' | 'expiresAt'> {
  const view = cartView(cart)
  const lines: QuoteLine[] = view.items.map((item) => ({
    itemId: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    tokenId: item.tokenId,
    nftName: item.nftName,
    editionName: item.editionName,
    imageUrl: item.imageUrl,
    quantity: item.quantity,
    unitPriceEth: item.unitPriceEth,
    lineTotalEth: mulEth(item.unitPriceEth, item.quantity),
  }))
  const issues: QuoteIssue[] = []
  for (const item of view.items) {
    if (item.available === 0) {
      issues.push({ itemId: item.id, kind: 'sold-out', message: `${item.nftName} (${item.editionName}) esgotou.` })
    } else if (item.quantity > item.available) {
      issues.push({
        itemId: item.id,
        kind: 'insufficient-stock',
        message: `${item.nftName} (${item.editionName}): restam apenas ${item.available}.`,
      })
    }
    if (compareEth(item.unitPriceEth, item.addedPriceEth) !== 0) {
      issues.push({
        itemId: item.id,
        kind: 'price-changed',
        message: `O preço de ${item.nftName} mudou de ${item.addedPriceEth} para ${item.unitPriceEth} ETH.`,
      })
    }
  }
  const subtotalEth = addEth('0', ...lines.map((l) => l.lineTotalEth))
  const couponCheck = cart.couponCode ? checkCoupon(cart.couponCode) : null
  const coupon = couponCheck?.ok ? { code: couponCheck.code, percentOff: couponCheck.percentOff } : null
  const discountEth = coupon ? percentOf(subtotalEth, coupon.percentOff) : '0'
  const networkFeeEth = lines.length ? NETWORK_FEES[network] : '0'
  const totalEth = addEth(subEth(subtotalEth, discountEth), networkFeeEth)
  return {
    cartVersion: cart.version,
    network,
    lines,
    coupon,
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth,
    issues,
  }
}

export function createQuote(cart: CartRecord, network: Network, userId: string | null): QuoteRecord {
  const state = db()
  const quote: QuoteRecord = {
    ...buildQuote(cart, network),
    id: nextId('quote'),
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    cartId: cart.id,
    userId,
    usedByOrderId: null,
  }
  // Keep only the latest few quotes per cart.
  const old = Object.values(state.quotes).filter((q) => q.cartId === cart.id && !q.usedByOrderId)
  for (const q of old.slice(0, Math.max(0, old.length - 4))) delete state.quotes[q.id]
  state.quotes[quote.id] = quote
  persist()
  return quote
}

/** Fingerprint of everything that affects what the buyer pays. */
function fingerprint(q: Pick<Quote, 'lines' | 'coupon' | 'networkFeeEth' | 'totalEth'>): string {
  return JSON.stringify([
    q.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth]),
    q.coupon?.code ?? null,
    q.networkFeeEth,
    q.totalEth,
  ])
}

export type QuoteValidation =
  | { ok: true; quote: QuoteRecord }
  | { ok: false; reason: 'stale' | 'issues'; fresh: QuoteRecord }

/** Re-prices the cart and compares with the quote the buyer confirmed. */
export function revalidateQuote(quote: QuoteRecord, cart: CartRecord): QuoteValidation {
  const current = buildQuote(cart, quote.network)
  const expired = Date.parse(quote.expiresAt) <= Date.now()
  if (expired || fingerprint(current) !== fingerprint(quote)) {
    return { ok: false, reason: 'stale', fresh: createQuote(cart, quote.network, quote.userId) }
  }
  if (current.issues.some((i) => i.kind !== 'price-changed')) {
    return { ok: false, reason: 'issues', fresh: createQuote(cart, quote.network, quote.userId) }
  }
  return { ok: true, quote }
}

/**
 * Scenario hooks that change the catalog right when an order is submitted, so
 * the server must reject the confirmed quote.
 */
export function applyCheckoutScenarios(quote: QuoteRecord) {
  const first = quote.lines[0]
  if (!first) return
  if (has('price-change-on-checkout') && hit('checkout:price') === 1) {
    updateEdition(first.nftId, first.editionId, { priceEth: addEth(first.unitPriceEth, '0.25') })
  }
  if (has('sold-out-on-checkout') && hit('checkout:soldout') === 1) {
    updateEdition(first.nftId, first.editionId, { available: 0 })
  }
}

// ---------- Orders ----------
export function settleDelay(): number {
  return has('payment-slow') ? SLOW_SETTLE_DELAY_MS : SETTLE_DELAY_MS
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      settleOrder(order.id)
    }, wait),
  )
}

/** Moves a pending order to its terminal state. Idempotent. */
export function settleOrder(orderId: string): OrderRecord | undefined {
  const state = db()
  const order = state.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return order
  const now = new Date().toISOString()
  order.updatedAt = now
  order.version += 1
  if (order.outcome === 'confirmed') {
    order.status = 'confirmed'
    const hash = `0x${Array.from(order.id + order.idempotencyKey)
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .padEnd(64, 'a')
      .slice(0, 64)}`
    order.txHash = hash
    order.explorerUrl = `https://etherscan.io/tx/${hash}`
    // Remove exactly what was bought from the buyer's cart.
    const cart = state.carts[order.cartId]
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.editionId === line.editionId)
        if (!item) continue
        item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (order.coupon && cart.items.length === 0) cart.couponCode = null
      cart.version += 1
    }
  } else {
    order.status = 'declined'
    order.declineReason = 'A carteira recusou a assinatura da transação.'
    // Release the reserved stock.
    for (const line of order.lines) {
      updateEdition(line.nftId, line.editionId, { availableDelta: line.quantity })
    }
  }
  persist()
  emitOrderUpdated(order)
  return order
}

/** Settles overdue orders (e.g. the page reloaded while a timer was pending). */
export function settleOverdueOrders() {
  for (const order of db().orders) {
    if (order.status !== 'pending') continue
    if (order.settleAt <= Date.now()) settleOrder(order.id)
    else scheduleSettlement(order)
  }
}

export function reserveStock(quote: QuoteRecord) {
  for (const line of quote.lines) {
    updateEdition(line.nftId, line.editionId, { availableDelta: -line.quantity })
  }
}
