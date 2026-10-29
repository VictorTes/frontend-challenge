import { expect, NFT, test, USERS } from './support/fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro valida campos, trata conflito e cria a conta @mobile', async ({ page, open }) => {
    await open('/register')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByLabel('Nome de usuário')).toBeFocused()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('nova_conta')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.alice.email)
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha').fill('Segura123')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.').first()).toBeVisible()

    await page.getByLabel('E-mail', { exact: true }).fill('nova@kurio.test')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page).toHaveURL('/')
    await page.reload()
    await page.goto('/account/profile')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('nova_conta')
  })

  test('login inválido, login e retorno ao fluxo anterior', async ({ page, open }) => {
    await open('/account/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.alice.email)
    await page.getByLabel('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.')
    await page.getByLabel('Senha', { exact: true }).fill(USERS.alice.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/account/wallets')
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão é recuperada após refresh e expira durante a navegação', async ({ page, login, mock }) => {
    await login('alice', '/account/profile')
    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('alice')

    await mock.expireSessions()
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets&reason=expired/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
  })

  test('logout e troca de usuário não expõem dados do usuário anterior', async ({ page, login }) => {
    await login('alice', '/account/favorites')
    await expect(page.getByTestId('favorites-grid').locator('article')).toHaveCount(2)

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

    await login('bruno', '/account/favorites')
    const favorites = page.getByTestId('favorites-grid').locator('article')
    await expect(favorites).toHaveCount(1)
    await expect(favorites.first()).toContainText('Golden Beat #207')
    await expect(page.getByText(NFT.sage.name)).toHaveCount(0)
    // Private storage only holds the current session.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio:session') ?? '{}').user.email)
    expect(stored).toBe(USERS.bruno.email)
  })
})
