import type { Page } from '@playwright/test'
import { expect, isMobile } from './fixtures'

/** Adds the default (1/50) edition of an NFT from its detail page; ends on /cart. */
export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nfts/${nftId}`)
  const stepper = page.getByRole('group', { name: 'Quantidade' }).locator('visible=true')
  await expect(page.getByRole('radio', { name: '1/50' })).toBeChecked()
  for (let i = 1; i < quantity; i++) await stepper.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: isMobile(page) ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL('/cart')
}

/** Opens the review dialog and connects the selected wallet. */
export async function reviewAndConnect(page: Page) {
  await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise sua compra' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^Conectar / }).click()
  await expect(dialog.getByText('Carteira conectada')).toBeVisible()
  return dialog
}

