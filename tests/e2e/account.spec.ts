import { expect, test, USERS } from './support/fixtures'

// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Perfil e carteiras', () => {
  test('edição do perfil com validação, conflito e persistência @mobile', async ({ page, login }) => {
    await login('alice', '/account/profile')
    const name = page.getByLabel('Nome de exibição')
    await name.fill('')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(name).toBeFocused()
    await expect(page.getByText('Informe o nome de exibição')).toBeVisible()

    await name.fill('Alice Atualizada')
    await page.getByLabel('Nome de usuário').fill(USERS.bruno.username)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.').first()).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('alice_nova')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Alice Atualizada')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('alice_nova')
  })

  test('avatar: tipo inválido é rejeitado, upload e remoção persistem', async ({ page, login }) => {
    await login('alice', '/account/profile')
    const input = page.getByLabel('Escolher imagem de avatar')
    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByText('Envie uma imagem PNG, JPEG ou WebP.')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-image')).toBeVisible()

    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-image')).toHaveCount(0)
  })

  test('alteração de senha valida a senha atual e passa a valer no login', async ({ page, login }) => {
    await login('alice', '/account/profile')
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha9')
    await page.getByLabel('Confirmar nova senha').fill('Diferente9')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()

    await page.getByLabel('Confirmar nova senha').fill('NovaSenha9')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()

    await page.getByLabel('Senha atual').fill(USERS.alice.password)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil e senha atualizados.')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.alice.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.alice.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.')
    await page.getByLabel('Senha', { exact: true }).fill('NovaSenha9')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/')
  })

  test('cadastro e edição das carteiras principal e secundária com erros de validação @mobile', async ({ page, login }) => {
    await login('bruno', '/account/wallets')
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    const primary = page.getByTestId('wallet-primary-form')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Informe o apelido da carteira')).toBeVisible()
    await expect(primary.getByText('Escolha a rede da carteira')).toBeVisible()

    await primary.getByLabel('Apelido da carteira').fill('Principal')
    await primary.getByRole('combobox', { name: 'Rede' }).click()
    await page.getByRole('option', { name: 'Ethereum' }).click()
    await primary.getByRole('combobox', { name: 'Tipo de carteira' }).click()
    await page.getByRole('option', { name: 'MetaMask' }).click()
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText(/Endereço inválido/)).toBeVisible()

    await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()

    // Secondary wallet: "same as primary" copies data, address must differ.
    await page.getByLabel('Igual à carteira principal').check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByTestId('wallet-secondary-form')
    await secondary.getByLabel('Apelido da carteira').fill('Reserva')
    await secondary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado em outra carteira.')).toBeVisible()
    await secondary.getByLabel('Endereço da carteira').fill('0x2222222222222222222222222222222222222222')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()

    // Edit + persistence
    await primary.getByLabel('Apelido da carteira').fill('Cofre')
    const saved = page.waitForResponse((r) => r.url().includes('/api/me/wallets/') && r.request().method() === 'PUT')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    expect((await saved).ok()).toBe(true)
    await page.reload()
    await expect(page.getByTestId('wallet-primary-form').getByLabel('Apelido da carteira')).toHaveValue('Cofre')
    await expect(page.getByTestId('wallet-secondary-form').getByLabel('Apelido da carteira')).toHaveValue('Reserva')
  })
})
