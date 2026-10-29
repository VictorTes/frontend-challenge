import { expect, isMobile, NFT, test } from './support/fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto carrega galeria, informações e edições @mobile', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await expect(page.getByRole('heading', { level: 1, name: NFT.emerald.name })).toBeVisible()
    await expect(page.getByRole('radio', { name: '1/50' })).toBeChecked()
    await expect(page.getByText('ID do token:').filter({ visible: true })).toBeVisible()
    await page.getByRole('button', { name: 'Imagem 2 de 4' }).click()
    await expect(page.getByRole('button', { name: 'Imagem 2 de 4' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('NFT inexistente mostra 404', async ({ page, open }) => {
    await open('/nfts/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  })

  test('rota inexistente mostra 404', async ({ page, open }) => {
    await open('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição esgotada fica indisponível e o limite de quantidade é respeitado', async ({ page, open, mock }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    await expect(page.getByRole('radio', { name: '1/50' })).toBeChecked()

    // Sell out the 1/1 edition on the server: the realtime event disables it.
    await mock.setEdition(NFT.emerald.id, 'emerald-ape-042-1of1', { available: 0 })
    await expect(page.getByRole('radio', { name: /^1\/1( |$)/ })).toBeDisabled()

    // 1/10 edition: limit 3 per order.
    await page.locator('label').filter({ visible: true, hasText: /^1\/10$/ }).click()
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' }).first()
    await increase.click()
    await increase.click()
    await expect(increase).toBeDisabled()
    await expect(page.getByRole('group', { name: 'Quantidade' }).first().locator('output')).toHaveText('3')
  })

  test('cliques no mesmo instante no seletor de quantidade somam todos', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    const stepper = page.getByRole('group', { name: 'Quantidade' }).locator('visible=true')
    await stepper.getByRole('button', { name: 'Aumentar quantidade' }).evaluate((button: HTMLButtonElement) => {
      for (let i = 0; i < 3; i++) button.click()
    })
    await expect(stepper.locator('output')).toHaveText('4')
  })

  test('mobile: "Ver mais detalhes" mostra abas, compartilhar e relacionados como no desktop @mobile', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    test.skip(!isMobile(page), 'Desktop already shows everything')
    const toggle = page.getByRole('button', { name: 'Ver mais detalhes' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(page.getByRole('button', { name: 'Ver menos detalhes' })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('Contrato inteligente ERC-721')
    await page.getByRole('tab', { name: /Avaliações/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('4.8 de 5')
    await expect(page.getByRole('link', { name: /Compartilhar no LinkedIn/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
  })
})

