import { expect, NFT, test } from './support/fixtures'
import { addToCart, reviewAndConnect } from './support/flows'

/**
 * Every event here is emitted by the simulated server (MSW + socket.io
 * binding) and received by the app's real socket.io-client.
 */
test.describe('Tempo real (Socket.IO)', () => {
  test('alteração de preço com NFT no carrinho atualiza o resumo e bloqueia cotação desatualizada @mobile', async ({ page, login, mock }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')
    await expect.poll(async () => (await mock.state()).sockets).toBeGreaterThan(0)

    await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '1.5' })
    await expect(page.getByText(/teve preço ou disponibilidade alterados/)).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Preços atualizados.' })).toBeVisible()
    await expect(page.getByTestId('quote-subtotal')).toHaveText('1.50 ETH')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()

    await page.getByRole('button', { name: 'Aceitar novos preços' }).click()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
    await expect(page.getByTestId('quote-total')).toHaveText('1.516 ETH')
  })

  test('mudança durante a revisão exige nova confirmação antes da compra', async ({ page, login, mock }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)

    await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '1.6' })
    await expect(dialog.getByText('Os valores do pedido mudaram')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

    await dialog.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(dialog.getByTestId('quote-total')).toHaveText('1.616 ETH')
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.616 ETH')
  })

  test('servidor rejeita cotação alterada no envio e exige nova confirmação', async ({ page, open, login, mock }) => {
    await open('/', 'price-change-on-checkout')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(dialog.getByText('Os valores do pedido mudaram')).toBeVisible()
    await expect(dialog.getByText(/1\.19 ETH → 1\.44 ETH/).first()).toBeVisible()
    expect((await mock.orders()).items).toHaveLength(0)

    await dialog.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.456 ETH')
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ page, open, mock }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await expect.poll(async () => (await mock.state()).sockets).toBeGreaterThan(0)
    const price = page.getByTestId('nft-price')
    const first = await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '1.1' })
    await expect(price).toHaveText('1.10 ETH')
    const second = await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '1.05' })
    await expect(price).toHaveText('1.05 ETH')

    await mock.replay(first.eventId) // older version
    await mock.replay(second.eventId) // duplicate
    await page.waitForTimeout(500)
    await expect(price).toHaveText('1.05 ETH')
  })

  test('desconexão e reconexão reconciliam com a API REST', async ({ page, open, mock }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await expect.poll(async () => (await mock.state()).sockets).toBeGreaterThan(0)
    await mock.disconnectSockets(true)
    await expect(page.getByRole('status').filter({ hasText: 'Reconectando…' })).toBeVisible()

    // Changes while offline: the event is lost, REST has the truth.
    await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '0.95' })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('nft-price')).toHaveText('1.19 ETH')

    await mock.restoreSockets()
    await expect(page.getByTestId('nft-price')).toHaveText('0.95 ETH', { timeout: 10_000 })
    await expect(page.getByRole('status').filter({ hasText: 'Reconectando…' })).toHaveCount(0)
  })

  test('pedido pendente é retomado após refresh e reconexão sem criar outra compra', async ({ page, open, login, mock }) => {
    await open('/', 'payment-slow')
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()
    const orderId = orderUrl.split('/orders/')[1]!

    // Refresh: still the same pending order.
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // Returning to checkout resumes the pending order instead of buying again.
    await page.goto('/checkout')
    await expect(page).toHaveURL(orderUrl)

    // Payment settles while the socket is down; reconnection reconciles via REST.
    await expect.poll(async () => (await mock.state()).sockets).toBeGreaterThan(0)
    await mock.disconnectSockets(true)
    await mock.settleOrder(orderId)
    await mock.restoreSockets()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    expect((await mock.orders()).items).toHaveLength(1)
  })
})
