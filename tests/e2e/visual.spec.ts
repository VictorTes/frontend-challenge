import type { Page } from '@playwright/test'
import { expect, isMobile, NFT, test } from './support/fixtures'
import { addToCart } from './support/flows'

/**
 * Visual regression with versioned baselines. Data is the deterministic mock
 * seed; fonts and every lazy image are loaded and toasts hidden before capture.
 */
async function settle(page: Page) {
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) img.loading = 'eager'
    await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)))
    await document.fonts.ready
  })
  await page.waitForLoadState('networkidle')
}

test.describe('Regressão visual', () => {
  test('início @mobile', async ({ page, open }) => {
    await open('/')
    await expect(page.getByTestId('catalog-grid').locator('article')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT @mobile', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await expect(page.getByRole('heading', { level: 1, name: NFT.emerald.name })).toBeVisible()
    // The mobile frame has no related carousel: wait for the buy bar instead.
    if (isMobile(page)) await expect(page.getByRole('button', { name: 'Comprar NFT', exact: true })).toBeVisible()
    else await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho @mobile', async ({ page, open }) => {
    await open('/')
    await addToCart(page, NFT.emerald.id, 2)
    await addToCart(page, NFT.sage.id)
    await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento @mobile', async ({ page, login }) => {
    await login('alice', '/')
    await addToCart(page, NFT.emerald.id, 2)
    await page.goto('/checkout')
    await expect(page.getByTestId('quote-total')).toHaveText('2.396 ETH')
    // Desktop frame picks the wallet in a select; mobile lists it as radios.
    if (isMobile(page)) await expect(page.getByRole('radio', { name: /Principal/ })).toBeChecked()
    else await expect(page.getByRole('combobox', { name: /Endereço da carteira/ })).toContainText('Principal')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
