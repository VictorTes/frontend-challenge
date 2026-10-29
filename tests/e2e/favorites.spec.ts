import type { Page } from '@playwright/test'
import { expect, isMobile, NFT, test } from './support/fixtures'

/** Heart button: icon-only on mobile, labelled button on desktop. */
const heart = (page: Page, favorite: boolean) =>
  isMobile(page)
    ? page.getByRole('button', { name: favorite ? `Remover ${NFT.emerald.name} dos favoritos` : `Favoritar ${NFT.emerald.name}` }).first()
    : page.getByRole('button', { name: favorite ? 'Favoritado' : 'Favoritar', exact: true })

test.describe('Favoritos', () => {
  test('favoritar persiste para o usuário autenticado @mobile', async ({ page, login }) => {
    await login('bruno', `/nfts/${NFT.emerald.id}`)
    // MSW handlers run in the page: wait for the mutation before reloading.
    const saved = page.waitForResponse((r) => r.url().includes('/api/me/favorites/') && r.request().method() === 'PUT')
    await heart(page, false).click()
    await expect(heart(page, true)).toHaveAttribute('aria-pressed', 'true')
    expect((await saved).ok()).toBe(true)
    await page.reload()
    await expect(heart(page, true)).toBeVisible()
    await page.goto('/account/favorites')
    await expect(page.getByTestId('favorites-grid')).toContainText(NFT.emerald.name)
  })

  test('falha na mutation reverte o estado otimista e informa o erro', async ({ page, login, mock }) => {
    await login('bruno', `/nfts/${NFT.emerald.id}`)
    // Slow responses make the optimistic state observable before the rollback.
    await mock.setScenario('favorites-error,slow')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    // Optimistic flip happens first...
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
    // ...then the 500 rolls it back with feedback.
    await expect(page.getByText(/Não foi possível favoritar/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'false')

    // Recovery: once the backend works again, the same action succeeds.
    await mock.setScenario('default')
    const saved = page.waitForResponse((r) => r.url().includes('/api/me/favorites/') && r.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    expect((await saved).ok()).toBe(true)
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
  })

  test('cliques seguidos no favorito terminam no estado do último clique, também no servidor', async ({ page, login }) => {
    await login('bruno', `/nfts/${NFT.emerald.id}`)
    const button = page.getByRole('button', { name: /^(Favoritar|Favoritado)$/ })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    // Five toggles without waiting for the API: on, off, on, off, on.
    for (let i = 0; i < 5; i++) await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await page.waitForLoadState('networkidle')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante é enviado ao login ao favoritar', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})
