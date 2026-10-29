import { expect, NFT, test } from './support/fixtures'
import { addToCart, reviewAndConnect } from './support/flows'

test.describe('Compra', () => {
  test('compra completa do catálogo ao recibo confirmado @mobile', async ({ page, login, mock }) => {
    await login('alice', '/')
    await page.getByRole('link', { name: NFT.emerald.name, exact: true }).first().click()
    await expect(page).toHaveURL(`/nfts/${NFT.emerald.id}`)
    await addToCart(page, NFT.emerald.id, 2)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL('/checkout')
    await expect(page.getByTestId('quote-total')).toHaveText('2.396 ETH')

    const dialog = await reviewAndConnect(page)
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/orders\/order-/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // order.updated arrives over Socket.IO when the simulated payment settles.
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('receipt-line')).toHaveCount(1)
    await expect(page.getByTestId('tx-hash')).toHaveText(/^0x/)

    // The receipt is a snapshot: later catalog changes do not alter it.
    await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { priceEth: '9.99' })
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')

    // Only the purchased quantities left the cart.
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    expect((await mock.orders()).items).toHaveLength(1)
  })

  test('validação dos campos do pagamento foca o primeiro erro', async ({ page, login }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    await page.getByLabel('Nome de exibição').fill('')
    await page.getByLabel('E-mail', { exact: true }).fill('invalido')
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
    await expect(page.getByLabel('Nome de exibição')).toBeFocused()
    await expect(page.getByText('Informe o nome de exibição')).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('sessão expirada no checkout preserva o contexto para retomada', async ({ page, login, mock }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id)
    await page.goto('/checkout')
    await page.getByLabel('Observação do colecionador (opcional)').fill('Entregar na carteira principal')
    // Expire only after the quote loaded, so the 401 comes from the confirmation step.
    await expect(page.getByTestId('quote-total')).toHaveText(/ETH$/)
    await mock.expireSessions()
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Conectar / }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout&reason=expired/)
    await page.getByLabel('E-mail', { exact: true }).fill('alice@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('Kurio@2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/checkout')
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira principal')
    await expect(page.getByTestId('checkout-lines')).toContainText(NFT.emerald.name)
  })
})
