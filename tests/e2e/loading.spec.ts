import { expect, NFT, test } from './support/fixtures'

test.describe('Carregamento, falhas e recuperação', () => {
  test('skeletons durante carregamento lento @mobile', async ({ page, open }) => {
    await open('/', 'slow')
    await expect(page.getByLabel('Carregando catálogo')).toBeVisible()
    await expect(page.getByTestId('catalog-grid').locator('article').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel('Carregando catálogo')).toHaveCount(0)

    await page.goto(`/nfts/${NFT.sage.id}`)
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: NFT.sage.name })).toBeVisible({ timeout: 15_000 })
  })

  test('skeleton tem shimmer e fica estático com movimento reduzido', async ({ page, open }) => {
    const sweep = () =>
      page
        .locator('[data-slot="skeleton"]')
        .first()
        .evaluate((el) => getComputedStyle(el, '::after').animationName)
    await open('/', 'slow')
    await expect(page.getByLabel('Carregando catálogo')).toBeVisible()
    expect(await sweep()).toBe('shimmer')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByLabel('Carregando catálogo')).toBeVisible()
    expect(await sweep()).toBe('none')
  })

  test('falha transitória mostra erro e recupera com nova tentativa', async ({ page, open }) => {
    // flaky: the first 2 catalog requests fail with 503 (1 automatic retry).
    await open('/', 'flaky')
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid').locator('article')).toHaveCount(9)
  })

  test('erro HTTP 500 no detalhe mostra feedback com nova tentativa', async ({ page, open, mock }) => {
    await open(`/nfts/${NFT.emerald.id}`, 'server-error')
    await expect(page.getByText('Não foi possível carregar este NFT')).toBeVisible()
    await expect(page.getByText('O servidor falhou ao processar a requisição.')).toBeVisible()
    await mock.setScenario('default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: NFT.emerald.name })).toBeVisible()
  })

  test('sem conexão mostra mensagem de rede', async ({ page, open }) => {
    await open('/', 'offline')
    await expect(page.getByText('Sem conexão com o servidor. Verifique sua rede.')).toBeVisible()
  })
})
