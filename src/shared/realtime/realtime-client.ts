/**
 * Socket.IO client and the rules for applying server events to the Query cache.
 *
 * - Events carry a stable id (dedupe) and a per-resource version (ordering).
 * - Duplicates and versions <= the last applied one are ignored, so effects are
 *   never re-applied and newer state never regresses.
 * - order.updated events for another user are discarded.
 * - After a reconnection, active resources are re-fetched from REST, which is
 *   the source of truth for anything missed while offline.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { io as ioFactory, Socket } from 'socket.io-client'
import { qk } from '@/shared/api/query-keys'
import {
  realtimeEvent,
  type Cart,
  type CatalogPage,
  type NftDetail,
  type NftSummary,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/shared/contracts'
import { compareEth } from '@/shared/lib/money'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export type RealtimeNotice = { kind: 'nft-changed'; nftId: string; name: string; inCart: boolean }

const MAX_SEEN = 500

export class RealtimeClient {
  private socket: Socket
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private wasConnected = false
  private statusListeners = new Set<(s: ConnectionStatus) => void>()
  private noticeListeners = new Set<(n: RealtimeNotice) => void>()
  status: ConnectionStatus = 'connecting'

  constructor(
    io: typeof ioFactory,
    private readonly queryClient: QueryClient,
    private readonly userId: string | null,
    token: string | null,
  ) {
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      // Give up on a hung connection attempt quickly and retry.
      timeout: 5000,
    })
    this.socket.on('connect', this.onConnect)
    this.socket.on('disconnect', this.onDisconnect)
    this.socket.io.on('reconnect_attempt', this.onReconnectAttempt)
    this.socket.on('nft.updated', this.onEvent)
    this.socket.on('order.updated', this.onEvent)
  }

  /** Releases every listener; called when the session changes or on unmount. */
  dispose() {
    this.socket.off('connect', this.onConnect)
    this.socket.off('disconnect', this.onDisconnect)
    this.socket.io.off('reconnect_attempt', this.onReconnectAttempt)
    this.socket.off('nft.updated', this.onEvent)
    this.socket.off('order.updated', this.onEvent)
    this.socket.disconnect()
    this.statusListeners.clear()
    this.noticeListeners.clear()
  }

  onStatus(listener: (s: ConnectionStatus) => void) {
    this.statusListeners.add(listener)
    return () => void this.statusListeners.delete(listener)
  }

  onNotice(listener: (n: RealtimeNotice) => void) {
    this.noticeListeners.add(listener)
    return () => void this.noticeListeners.delete(listener)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    for (const l of this.statusListeners) l(status)
  }

  private onConnect = () => {
    const isReconnect = this.wasConnected
    this.wasConnected = true
    this.setStatus('connected')
    if (isReconnect) this.reconcile()
  }

  private onDisconnect = () => {
    this.setStatus('reconnecting')
  }

  private onReconnectAttempt = () => {
    this.setStatus('reconnecting')
  }

  /** REST is the source of truth for anything missed while disconnected. */
  private reconcile() {
    const qc = this.queryClient
    void qc.invalidateQueries({ queryKey: qk.catalogAll, refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: ['nft'], refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: qk.cartAll, refetchType: 'active' })
    void qc.invalidateQueries({
      queryKey: qk.quoteAll(this.userId ?? 'guest'),
      refetchType: 'active',
    })
    if (this.userId)
      void qc.invalidateQueries({ queryKey: qk.orderAll(this.userId), refetchType: 'active' })
  }

  private onEvent = (raw: unknown) => {
    const parsed = realtimeEvent.safeParse(raw)
    if (!parsed.success) return
    const event = parsed.data
    if (!this.accept(event)) return
    if (event.type === 'nft.updated') this.applyNftUpdated(event)
    else this.applyOrderUpdated(event)
  }

  /** Dedupe by id, reject stale versions, reject other users' events. */
  private accept(event: RealtimeEvent): boolean {
    if (this.seen.has(event.id)) return false
    if (event.type === 'order.updated' && event.userId !== this.userId) return false
    const key = `${event.resource.type}:${event.resource.id}`
    const last = this.versions.get(key) ?? 0
    if (event.version <= last) return false
    this.seen.add(event.id)
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value!)
    this.versions.set(key, event.version)
    return true
  }

  private applyNftUpdated(event: NftUpdatedEvent) {
    const qc = this.queryClient
    const { nftId, priceEth, compareAtPriceEth, available, editions } = event.payload
    const patchSummary = <T extends NftSummary>(nft: T): T =>
      nft.id === nftId && nft.version < event.version
        ? { ...nft, priceEth, compareAtPriceEth, available, version: event.version }
        : nft

    qc.setQueryData<NftDetail>(qk.nft(nftId), (nft) => {
      if (!nft || nft.version >= event.version) return nft
      return {
        ...patchSummary(nft),
        editions: nft.editions.map((e) => {
          const update = editions.find((u) => u.id === e.id)
          return update ? { ...e, priceEth: update.priceEth, available: update.available } : e
        }),
      }
    })
    qc.setQueriesData<CatalogPage>({ queryKey: qk.catalogAll }, (page) =>
      page ? { ...page, items: page.items.map(patchSummary) } : page,
    )
    qc.setQueriesData<{ items: NftSummary[] }>({ queryKey: qk.featured }, (data) =>
      data ? { items: data.items.map(patchSummary) } : data,
    )
    qc.setQueriesData<{ items: NftSummary[] }>({ queryKey: qk.relatedAll }, (data) =>
      data ? { items: data.items.map(patchSummary) } : data,
    )

    // The cart and any open quote are re-priced by the server.
    const carts = qc.getQueriesData<Cart>({ queryKey: qk.cartAll })
    const cartItems = carts.flatMap(([, c]) => c?.items ?? []).filter((i) => i.nftId === nftId)
    const cartItem = cartItems[0]
    // Only tell the buyer when their line is affected: another price for the
    // edition they hold, or less stock than the quantity they chose. (A stock
    // drop caused by their own purchase, with enough left, is not news.)
    const affectsCart = cartItems.some((item) => {
      const update = editions.find((e) => e.id === item.editionId)
      return Boolean(
        update &&
        (compareEth(update.priceEth, item.unitPriceEth) !== 0 || update.available < item.quantity),
      )
    })
    if (cartItem) {
      // A price change does not bump the cart version, so quotes are invalidated explicitly.
      void qc.invalidateQueries({ queryKey: qk.cartAll })
      void qc.invalidateQueries({ queryKey: qk.quoteAll(this.userId ?? 'guest') })
    }
    const name = cartItem?.nftName ?? qc.getQueryData<NftDetail>(qk.nft(nftId))?.name ?? 'Um NFT'
    for (const l of this.noticeListeners)
      l({ kind: 'nft-changed', nftId, name, inCart: affectsCart })
  }

  private applyOrderUpdated(event: OrderUpdatedEvent) {
    if (!this.userId) return
    this.queryClient.setQueryData<Order>(qk.order(this.userId, event.resource.id), (current) =>
      current && current.version >= event.version ? current : event.payload.order,
    )
    if (event.payload.order.status === 'confirmed') {
      // The server removed the purchased quantities from the cart.
      void this.queryClient.invalidateQueries({ queryKey: qk.cartAll })
    }
  }
}
