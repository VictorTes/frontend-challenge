import { expect, NFT, test } from './support/fixtures'

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
})
