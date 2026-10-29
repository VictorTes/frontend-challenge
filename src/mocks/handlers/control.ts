/**
 * Mock control API: reset, scenario selection and server-side event triggers.
 * Tests and the dev panel use it to change the *simulated backend*; the UI
 * then learns about changes only through REST and the Socket.IO client.
 */
import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ethString } from '@/shared/contracts'
import { db, persist, resetDb } from '../db/store'
import { settleOrder, updateEdition } from '../domain'
import { API, apiError, readJson } from '../http'
import { connectionCount, disconnectAll, recentEvents, replayEvent, unblock } from '../realtime'
import { activeScenarios, parseScenarios, scenarioDescriptions, setScenarios } from '../scenarios'

const MOCK = `${API}/__mock`

export const controlHandlers = [
  http.get(`${MOCK}/state`, () =>
    HttpResponse.json({
      scenarios: activeScenarios(),
      available: scenarioDescriptions,
      sockets: connectionCount(),
      events: recentEvents().map((e) => ({ id: e.id, type: e.type, resource: e.resource, version: e.version })),
    }),
  ),

  http.post(`${MOCK}/reset`, async ({ request }) => {
    const body = (await readJson(request)) as { scenario?: string } | null
    await resetDb()
    setScenarios(parseScenarios(body?.scenario))
    unblock()
    return HttpResponse.json({ scenarios: activeScenarios() })
  }),

  http.put(`${MOCK}/scenario`, async ({ request }) => {
    const body = (await readJson(request)) as { scenario?: string } | null
    setScenarios(parseScenarios(body?.scenario))
    return HttpResponse.json({ scenarios: activeScenarios() })
  }),

  /** Changes price/stock of an edition and emits `nft.updated` over the socket. */
  http.post(`${MOCK}/nfts/:nftId/editions/:editionId`, async ({ request, params }) => {
    const parsed = z
      .object({ priceEth: ethString.optional(), available: z.number().int().min(0).optional() })
      .safeParse(await readJson(request))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'priceEth/available inválidos')
    const nft = updateEdition(String(params.nftId), String(params.editionId), parsed.data)
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT/edição não encontrada')
    const event = recentEvents().at(-1)
    return HttpResponse.json({ nft, eventId: event?.id })
  }),

  http.get(`${MOCK}/realtime/events`, () => HttpResponse.json({ items: recentEvents() })),

  /** Re-delivers an earlier event (duplicate, or stale if newer ones exist). */
  http.post(`${MOCK}/realtime/replay`, async ({ request }) => {
    const body = (await readJson(request)) as { eventId?: string } | null
    if (!body?.eventId || !replayEvent(body.eventId)) return apiError(404, 'NOT_FOUND', 'Evento não encontrado')
    return HttpResponse.json({ replayed: body.eventId })
  }),

  /** Drops socket connections; `block: true` keeps refusing reconnections. */
  http.post(`${MOCK}/realtime/disconnect`, async ({ request }) => {
    const body = (await readJson(request)) as { block?: boolean } | null
    return HttpResponse.json({ closed: disconnectAll(Boolean(body?.block)) })
  }),

  http.post(`${MOCK}/realtime/restore`, () => {
    unblock()
    return HttpResponse.json({ ok: true })
  }),

  /** Expires every active session (server side), as if the TTL elapsed. */
  http.post(`${MOCK}/sessions/expire`, () => {
    const past = new Date(Date.now() - 1000).toISOString()
    for (const s of db().sessions) s.expiresAt = past
    persist()
    return HttpResponse.json({ ok: true })
  }),

  /** Settles a pending order immediately (instead of waiting for the timer). */
  http.post(`${MOCK}/orders/:orderId/settle`, ({ params }) => {
    const order = settleOrder(String(params.orderId))
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
    return HttpResponse.json({ status: order.status })
  }),
]
