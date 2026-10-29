import type { Page } from '@playwright/test'
import { expect, NFT, test } from './support/fixtures'
import { addToCart, reviewAndConnect } from './support/flows'

type Attempt = { key: string; payload: Record<string, unknown> & { buyer: Record<string, unknown> } }

/** Calls POST /orders from the page with the current session token. */
function postOrder(page: Page, key: string, body: unknown) {
  return page.evaluate(
    async ({ key, body }) => {
      const session = JSON.parse(localStorage.getItem('kurio:session') ?? 'null')
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'Idempotency-Key': key },
        body: JSON.stringify(body),
      })
      return { status: res.status, body: await res.json() }
    },
    { key, body },
  )
}

async function placePendingOrder(page: Page) {
  await addToCart(page, NFT.emerald.id)
  await page.goto('/checkout')
  const dialog = await reviewAndConnect(page)
  await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('order-pending')).toBeVisible()
  return page.url().split('/orders/')[1]!
}

test.describe('Regras do servidor simulado', () => {
  test('item esgotado no envio bloqueia a compra e orienta o ajuste do carrinho', async ({ page, open, login, mock }) => {
    await open('/', 'sold-out-on-checkout')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(dialog.getByText('Os valores do pedido mudaram')).toBeVisible()
    await expect(dialog.getByText(/esgotou/).first()).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Ajustar quantidades no carrinho' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    expect((await mock.orders()).items).toHaveLength(0)
  })

  test('mesma chave de idempotência: mesmo pedido; conteúdo diferente: 409', async ({ page, open, login }) => {
    await open('/', 'payment-slow')
    await login('alice', '/')
    const orderId = await placePendingOrder(page)
    const attempt = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kurio:checkout-attempt:user-alice') ?? 'null'),
    ) as Attempt
    expect(attempt.key).toBeTruthy()

    const replay = await postOrder(page, attempt.key, attempt.payload)
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(orderId)

    const conflict = await postOrder(page, attempt.key, {
      ...attempt.payload,
      buyer: { ...attempt.payload.buyer, note: 'conteúdo diferente' },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  test('pedido de outro usuário não é exposto (403)', async ({ page, open, login }) => {
    await open('/', 'payment-slow')
    await login('alice', '/')
    const orderId = await placePendingOrder(page)

    await page.goto('/account/profile')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await login('bruno', `/orders/${orderId}`)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)

    const status = await page.evaluate(async (id) => {
      const session = JSON.parse(localStorage.getItem('kurio:session') ?? 'null')
      const res = await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${session.token}` } })
      return { status: res.status, code: (await res.json()).error?.code }
    }, orderId)
    expect(status).toEqual({ status: 403, code: 'FORBIDDEN' })
  })

  test('logout e troca de usuário liberam o socket da sessão anterior', async ({ page, login, mock }) => {
    await login('alice', '/account/profile')
    await expect.poll(async () => (await mock.state()).sockets).toBe(1)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await login('bruno', '/')
    // One socket for the current session only: the previous ones were disposed.
    await expect.poll(async () => (await mock.state()).sockets).toBe(1)
  })

  test('latência variável não altera o resultado final do catálogo', async ({ page, open }) => {
    await open('/', 'variable-latency')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.locator('article')).toHaveCount(9)
    await page.getByRole('button', { name: 'Página 2' }).click()
    await page.getByRole('button', { name: 'Página 3' }).click()
    await page.getByRole('button', { name: 'Página 4' }).click()
    await expect(page).toHaveURL(/page=4/)
    await page.waitForTimeout(1500)
    const names = await grid.locator('article h3').allTextContents()
    await open('/?page=4')
    await expect.poll(() => grid.locator('article h3').allTextContents()).toEqual(names)
  })
})
