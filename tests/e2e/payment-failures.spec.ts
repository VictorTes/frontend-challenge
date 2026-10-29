import { expect, NFT, test } from './support/fixtures'
import { addToCart, reviewAndConnect } from './support/flows'

test.describe('Falhas de pagamento', () => {
  test('pagamento recusado preserva os itens do carrinho @mobile', async ({ page, open, login, mock }) => {
    await open('/', 'payment-declined')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id, 2)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-confirmed')).toHaveCount(0)
    await page.goto('/cart')
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('cart-item')).toContainText('2')
    expect((await mock.orders()).items.map((o) => o.status)).toEqual(['declined'])
  })

  test('cliques repetidos criam um único pedido', async ({ page, login, mock }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    const confirm = dialog.getByRole('button', { name: 'Confirmar compra' })
    // Two clicks in the same tick: the synchronous lock lets only one through.
    await confirm.dblclick()
    await expect(page).toHaveURL(/\/orders\/order-/)
    expect((await mock.orders()).items).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido por idempotência', async ({ page, open, login, mock }) => {
    await page.clock.install()
    await open('/', 'order-timeout')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(dialog.getByText('Enviando pedido…')).toBeVisible()

    // The server created the order but the response is lost: the client times out.
    await page.clock.fastForward(11_000)
    await expect(dialog.getByRole('alert')).toContainText('O servidor demorou para responder.')
    await expect(dialog.getByText('não gera cobrança duplicada')).toBeVisible()
    expect((await mock.orders()).items).toHaveLength(1)

    // Retrying reuses the idempotency key and recovers the same order.
    await dialog.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/orders\/order-/)
    const orders = (await mock.orders()).items
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0]!.id)
  })

  test('carteira recusada informa o erro e permite nova tentativa', async ({ page, open, login, mock }) => {
    await open('/', 'wallet-rejected')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revise sua compra' })
    await dialog.getByRole('button', { name: /^Conectar / }).click()
    await expect(dialog.getByRole('alert')).toContainText('A conexão foi recusada na carteira.')
    await expect(dialog.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

    await mock.setScenario('default')
    await dialog.getByRole('button', { name: /^Conectar / }).click()
    await expect(dialog.getByText('Carteira conectada')).toBeVisible()
    await dialog.getByRole('button', { name: 'Desconectar' }).click()
    await expect(dialog.getByRole('button', { name: /^Conectar / })).toBeVisible()
    expect((await mock.orders()).items).toHaveLength(0)
  })
})
