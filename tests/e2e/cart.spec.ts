import type { Page } from '@playwright/test'
import { expect, NFT, test, USERS } from './support/fixtures'
import { addToCart } from './support/flows'

const item = (page: Page, nftId: string) => page.locator(`[data-testid="cart-item"][data-item="${nftId}"]`)

test.describe('Carrinho', () => {
  test('quantidades, remoção, resumo coerente e persistência após refresh @mobile', async ({ page, open }) => {
    await open('/')
    await addToCart(page, NFT.emerald.id, 2)
    await addToCart(page, NFT.sage.id)
    await expect(page.getByTestId('cart-item')).toHaveCount(2)

    // 2 × 1.19 + 1 × 1.69 = 4.07; Ethereum fee 0.016 → 4.086
    await expect(page.getByTestId('quote-subtotal')).toHaveText('4.07 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')

    await item(page, NFT.sage.id).getByRole('button', { name: `Aumentar quantidade de ${NFT.sage.name}` }).click()
    await expect(page.getByTestId('quote-subtotal')).toHaveText('5.76 ETH')

    await item(page, NFT.emerald.id).getByRole('button', { name: `Remover ${NFT.emerald.name} do carrinho` }).click()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('quote-subtotal')).toHaveText('3.38 ETH')

    await page.reload()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(page.getByTestId('quote-total')).toHaveText('3.396 ETH')
  })

  test('cupom válido, inválido, expirado e remoção', async ({ page, open }) => {
    await open('/')
    await addToCart(page, NFT.emerald.id, 2)
    const coupon = page.getByLabel('Código promocional')

    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido.' })).toBeVisible()

    await coupon.fill('VERAO20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Este código promocional expirou.' })).toBeVisible()

    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    // 10% of 2.38 = 0.238 → total 2.38 − 0.238 + 0.016 = 2.158
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.238 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('2.158 ETH')

    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.00 ETH')
  })

  test('itens do visitante são preservados ao autenticar', async ({ page, open }) => {
    await open('/')
    await addToCart(page, NFT.emerald.id, 2)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.alice.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.alice.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/checkout')
    await expect(page.getByTestId('checkout-lines')).toContainText(NFT.emerald.name)
    await expect(page.getByTestId('checkout-lines')).toContainText('(x 2)')
    await page.goto('/cart')
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
  })

  test('limite de disponibilidade por edição é respeitado no carrinho', async ({ page, open, mock }) => {
    await open('/')
    await addToCart(page, NFT.emerald.id, 3)
    // Stock drops below the quantity in the cart.
    await mock.setEdition(NFT.emerald.id, NFT.emerald.edition1of50, { available: 2 })
    await expect(item(page, NFT.emerald.id)).toContainText('restam apenas 2')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await item(page, NFT.emerald.id).getByRole('button', { name: `Diminuir quantidade de ${NFT.emerald.name}` }).click()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  })
})
