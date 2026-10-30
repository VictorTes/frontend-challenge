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

  test('mobile: arrastar a foto troca de imagem e as setas do teclado também @mobile', async ({ page, open }) => {
    await open(`/nfts/${NFT.emerald.id}`)
    test.skip(!isMobile(page), 'Swipe gallery is the phone layout')
    const gallery = page.getByRole('region', { name: `Fotos de ${NFT.emerald.name}` })
    const dot = (n: number) => page.getByRole('button', { name: `Imagem ${n} de 4` }).filter({ visible: true })
    await expect(dot(1)).toHaveAttribute('aria-pressed', 'true')
    // A real touch drag (CDP), not a programmatic scroll.
    const box = (await gallery.boundingBox())!
    const y = box.y + box.height / 2
    const cdp = await page.context().newCDPSession(page)
    const drag = async (from: number, to: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] })
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + ((to - from) * i) / 10, y }] })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await drag(box.x + box.width - 20, box.x + 20)
    await expect(dot(2)).toHaveAttribute('aria-pressed', 'true')
    // A short drag settles back on a whole photo instead of resting between two.
    await drag(box.x + box.width - 20, box.x + box.width - 120)
    await expect
      .poll(() => gallery.evaluate((el) => el.scrollLeft % el.clientWidth))
      .toBe(0)
    await expect(dot(2)).toHaveAttribute('aria-pressed', 'true')

    await gallery.focus()
    await page.keyboard.press('ArrowRight')
    await expect(dot(3)).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(dot(1)).toHaveAttribute('aria-pressed', 'true')
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

  test('card -> detalhe -> relacionado animam com View Transition, sem erros; filtros não animam', async ({ page, open }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __vt: { calls: number; errors: string[] } }
      w.__vt = { calls: 0, errors: [] }
      const start = document.startViewTransition?.bind(document)
      if (!start) return
      document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
        w.__vt.calls++
        const transition = start(update)
        transition.finished.catch((e: unknown) => w.__vt.errors.push(String(e)))
        return transition
      }) as typeof document.startViewTransition
    })
    const vt = () => page.evaluate(() => (window as unknown as { __vt: { calls: number; errors: string[] } }).__vt)
    await open('/')
    const card = page.getByTestId('catalog-grid').locator('article').first()
    await card.getByRole('link').first().click()
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toBeVisible()
    // The shared artwork lands on the detail image (one holder of the name).
    await expect(page.locator('img.vt-hero').filter({ visible: true })).toHaveCount(1)
    await page.getByRole('region', { name: 'Mais desta coleção' }).getByRole('link').first().click()
    await expect(page.locator('img.vt-hero').filter({ visible: true })).toHaveCount(1)
    await expect.poll(async () => (await vt()).calls).toBeGreaterThanOrEqual(2)
    expect((await vt()).errors).toEqual([])

    await page.goto('/')
    await expect(page.getByTestId('catalog-grid').locator('article')).toHaveCount(9)
    await page.waitForLoadState('networkidle')
    const before = (await vt()).calls
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await expect(page).toHaveURL(/tab=new/)
    expect((await vt()).calls).toBe(before)
  })
})

