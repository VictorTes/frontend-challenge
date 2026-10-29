import AxeBuilder from '@axe-core/playwright'
import { expect, NFT, test } from './support/fixtures'
import { addToCart } from './support/flows'

test.describe('Acessibilidade', () => {
  for (const path of ['/', `/nfts/${NFT.emerald.id}`, '/cart', '/login', '/register']) {
    test(`sem violações graves do axe em ${path} @mobile`, async ({ page, open }) => {
      await open(path)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    })
  }

  test('zoom de 400% (320px): sem rolagem horizontal nem conteúdo cortado', async ({ page, open }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    for (const path of ['/', `/nfts/${NFT.emerald.id}`, '/login', '/register']) {
      await open(path)
      await page.waitForLoadState('networkidle')
      expect(await overflow(), path).toBe(0)
    }
    await addToCart(page, NFT.emerald.id)
    await expect(page.getByTestId('quote-total')).toBeVisible()
    expect(await overflow(), '/cart').toBe(0)
  })

  test('link de pular conteúdo e navegação por teclado', async ({ page, open }) => {
    await open('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
  })

  test('abas do detalhe seguem o padrão de setas do WAI-ARIA', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    const details = page.getByRole('tab', { name: 'Detalhes do NFT' })
    const reviews = page.getByRole('tab', { name: /Avaliações de colecionadores/ })
    await details.focus()
    await page.keyboard.press('ArrowRight')
    await expect(reviews).toBeFocused()
    await expect(reviews).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('4.8 de 5')
    await page.keyboard.press('Home')
    await expect(details).toBeFocused()
    await expect(page.getByRole('tabpanel')).toContainText('Contrato inteligente ERC-721')
    // Only the selected tab is in the Tab order.
    await expect(reviews).toHaveAttribute('tabindex', '-1')
  })

  test('diálogo de busca prende o foco e devolve ao gatilho ao fechar', async ({ page, open }) => {
    await open('/')
    const trigger = page.getByRole('button', { name: 'Buscar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog.getByRole('searchbox', { name: 'Termo de busca' })).toBeFocused()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    await page.keyboard.type('golden')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=golden/)
  })

  test('formulário inválido enviado pelo teclado foca e anuncia o erro', async ({ page, open }) => {
    await open('/login')
    await page.getByLabel('E-mail', { exact: true }).focus()
    await page.keyboard.press('Enter')
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')
  })

  test('catálogo operável por teclado: filtro e paginação', async ({ page, open }) => {
    await open('/')
    await page.getByRole('button', { name: 'Página 2' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/page=2/)
    const filter = page.getByRole('complementary', { name: 'Filtros' }).getByRole('checkbox', { name: /Fotografia/ })
    await filter.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/collection=/)
    await expect(page).not.toHaveURL(/page=/)

    // Catalog tabs follow the arrow-key pattern.
    await page.getByRole('tab', { name: 'Todos os NFTs' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Novos lançamentos' })).toBeFocused()
    await expect(page).toHaveURL(/tab=new/)
  })
})
