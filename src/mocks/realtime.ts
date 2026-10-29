/**
 * Socket.IO server simulated with MSW's WebSocket interception and
 * @mswjs/socket.io-binding. The app talks to it with the real socket.io-client.
 *
 * Binding limitations (documented in ARCHITECTURE.md): default namespace only,
 * no rooms/acks, and the handshake is faked — so heartbeats and per-user
 * routing are done here by hand.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftDetail, RealtimeEvent } from '@/shared/contracts'
import { db, persist, type OrderRecord } from './db/store'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.nft.mock'

type Connection = {
  userId: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const connections = new Map<number, Connection>()
const eventLog: RealtimeEvent[] = []
let connectionSeq = 0
let blocked = false

const realtime = ws.link(`${SOCKET_URL}/*`)

export const realtimeHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const { client } = connection
    if (blocked) {
      queueMicrotask(() => client.close(1011, 'unavailable'))
      return
    }
    const io = toSocketIo(connection)
    const id = ++connectionSeq
    const conn: Connection = {
      userId: null,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => client.close(),
    }
    connections.set(id, conn)

    // The binding fakes a handshake with pingInterval=25s; keep the client alive.
    const heartbeat = setInterval(() => {
      if (connections.has(id)) client.send('2')
    }, 20_000)

    client.addEventListener('message', (event) => {
      const data = String(event.data)
      // The Socket.IO CONNECT packet carries the `auth` payload: 40{"token":"..."}
      if (!data.startsWith('40')) return
      try {
        const auth = JSON.parse(data.slice(2) || '{}') as { token?: string }
        const session = db().sessions.find(
          (s) => s.token === auth.token && Date.parse(s.expiresAt) > Date.now(),
        )
        conn.userId = session?.userId ?? null
      } catch {
        conn.userId = null
      }
    })
    client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(id)
    })
  }),
]

function record(event: RealtimeEvent) {
  eventLog.push(event)
  if (eventLog.length > 200) eventLog.shift()
}

function nextEventId(): string {
  const state = db()
  state.eventSeq += 1
  persist()
  return `evt-${state.eventSeq}`
}

export function emitNftUpdated(nft: NftDetail): RealtimeEvent {
  const event: RealtimeEvent = {
    id: nextEventId(),
    type: 'nft.updated',
    occurredAt: new Date().toISOString(),
    version: nft.version,
    resource: { type: 'nft', id: nft.id },
    payload: {
      nftId: nft.id,
      priceEth: nft.priceEth,
      compareAtPriceEth: nft.compareAtPriceEth,
      available: nft.available,
      editions: nft.editions.map(({ id, priceEth, available }) => ({ id, priceEth, available })),
    },
  }
  record(event)
  for (const conn of connections.values()) conn.emit(event.type, event)
  return event
}

export function emitOrderUpdated(order: OrderRecord): RealtimeEvent {
  const event: RealtimeEvent = {
    id: nextEventId(),
    type: 'order.updated',
    occurredAt: new Date().toISOString(),
    version: order.version,
    resource: { type: 'order', id: order.id },
    userId: order.userId,
    payload: { order: toPublicOrder(order) },
  }
  record(event)
  for (const conn of connections.values()) {
    if (conn.userId === order.userId) conn.emit(event.type, event)
  }
  return event
}

export function toPublicOrder(order: OrderRecord) {
  const {
    userId: _u,
    cartId: _c,
    idempotencyKey: _k,
    requestHash: _h,
    settleAt: _s,
    outcome: _o,
    ...publicOrder
  } = order
  return publicOrder
}

/** Re-sends a previously emitted event verbatim (duplicate or stale delivery). */
export function replayEvent(eventId: string): boolean {
  const event = eventLog.find((e) => e.id === eventId)
  if (!event) return false
  for (const conn of connections.values()) {
    if (event.type === 'order.updated' && conn.userId !== event.userId) continue
    conn.emit(event.type, event)
  }
  return true
}

export function recentEvents(): RealtimeEvent[] {
  return [...eventLog]
}

/** Drops all sockets; with `block`, new connections are refused until unblocked. */
export function disconnectAll(block: boolean): number {
  blocked = block
  const count = connections.size
  for (const conn of [...connections.values()]) conn.close()
  return count
}

export function unblock(): void {
  blocked = false
}

export function connectionCount(): number {
  return connections.size
}
