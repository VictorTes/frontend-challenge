import { expect, filtersInSheet, isMobile, test } from './support/fixtures'

const grid = (page: import('@playwright/test').Page) => page.getByTestId('catalog-grid')
const cardNames = (page: import('@playwright/test').Page) => grid(page).locator('article h3').allTextContents()

async function openFilters(page: import('@playwright/test').Page) {
  if (filtersInSheet(page)) await page.getByRole('button', { name: /Filtros/ }).click()
}

async function closeFilters(page: import('@playwright/test').Page) {
  if (filtersInSheet(page)) await page.keyboard.press('Escape')
}

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico @mobile', async ({ page, open }) => {
    await open('/')
    await expect(grid(page).locator('article')).toHaveCount(9)
    const firstPage = await cardNames(page)

    // Pagination
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect.poll(() => cardNames(page)).not.toEqual(firstPage)

    // Combined filters reset pagination
    await openFilters(page)
    const filters = page.getByRole(filtersInSheet(page) ? 'dialog' : 'complementary', { name: 'Filtros' }).first()
    await filters.getByText('Arte digital', { exact: true }).click()
    await expect(page).not.toHaveURL(/page=/)
    await filters.getByText('Ethereum', { exact: true }).click()
    await closeFilters(page)
    await expect(page).toHaveURL(/collection=.*arte-digital/)
    await expect(page).toHaveURL(/network=.*ethereum/)
    await expect(page.getByRole('button', { name: 'Remover filtro Arte digital' })).toBeVisible()

    // Sorting (below 768px the sort control lives in the filter sheet)
    if (isMobile(page)) await page.getByRole('button', { name: /Filtros/ }).click()
    await page.getByRole('combobox', { name: 'Ordenar por' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    if (isMobile(page)) await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/sort=price-asc/)
    await expect(grid(page)).toHaveAttribute('aria-busy', 'false')
    await expect(grid(page)).not.toHaveClass(/opacity-60/)
    const prices = await grid(page).locator('article p span.font-bold').allTextContents()
    const numeric = prices.map((p) => Number(p.replace(/[^\d.]/g, '')))
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b))
    const filtered = await cardNames(page)

    // Refresh keeps everything
    await page.reload()
    await expect.poll(() => cardNames(page)).toEqual(filtered)
    await expect(page.getByRole('button', { name: 'Remover filtro Arte digital' })).toBeVisible()

    // History restores previous states
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await expect(page).toHaveURL(/network=/)
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/collection=/)
  })

  test('busca por texto e resultado vazio', async ({ page, open }) => {
    await open('/?q=golden')
    await expect(grid(page).locator('article').first()).toBeVisible()
    for (const name of await cardNames(page)) expect(name.toLowerCase()).toContain('golden')

    await open('/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })

  test('cenário vazio da API mostra estado vazio', async ({ page, open }) => {
    await open('/', 'empty')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem o filtro mais recente', async ({ page, open }) => {
    await open('/', 'out-of-order')
    await expect(grid(page).locator('article').first()).toBeVisible()
    // The 1st catalog request was slow; trigger a slow request then a fast one.
    await page.getByRole('tab', { name: 'Em alta' }).click() // slow (odd)
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click() // fast (even)
    await expect(page).toHaveURL(/tab=new/)
    await page.waitForTimeout(2000) // let the slow, superseded response arrive
    await expect(page.getByRole('tab', { name: 'Novos lançamentos' })).toHaveAttribute('aria-selected', 'true')
    const names = await cardNames(page)
    // Same as loading the "new" tab directly.
    await open('/?tab=new')
    await expect.poll(() => cardNames(page)).toEqual(names)
  })
})
