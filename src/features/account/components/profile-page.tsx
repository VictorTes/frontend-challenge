import { ImageIcon } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/shared/api/errors'
import { ErrorState } from '@/shared/components/feedback'
import { Field, focusFirstError, issuesToErrors, PasswordField, TextField } from '@/shared/components/form-field'
import { MAX_AVATAR_BYTES, passwordChangeInput, profileInput, type ProfileInput, type User } from '@/shared/contracts'
import { Skeleton } from '@/shared/ui/skeleton'
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from '../hooks'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

function toForm(user: User): ProfileInput {
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    ensName: user.ensName ?? '',
    walletNickname: user.walletNickname ?? '',
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function AvatarEditor({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const updateAvatar = useUpdateAvatar()
  const [error, setError] = useState<string | null>(null)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    if (!ACCEPTED.includes(file.type)) {
      setError('Envie uma imagem PNG, JPEG ou WebP.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('A imagem deve ter no máximo 1 MB.')
      return
    }
    try {
      await updateAvatar.mutateAsync({ dataUrl: await readAsDataUrl(file) })
      toast.success('Avatar atualizado.')
    } catch (err) {
      setError(ApiError.from(err).message)
    }
  }

  const remove = async () => {
    setError(null)
    try {
      await updateAvatar.mutateAsync({ dataUrl: null })
      toast.success('Avatar removido.')
    } catch (err) {
      setError(ApiError.from(err).message)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px]" id="avatar-label">
        Avatar
      </span>
      <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Avatar atual" width={50} height={50} className="size-[50px] rounded-full object-cover" data-testid="avatar-image" />
        ) : (
          <span className="flex size-[50px] items-center justify-center rounded-full border border-primary bg-accent text-highlight" aria-label="Sem avatar">
            <ImageIcon aria-hidden className="size-5" />
          </span>
        )}
        <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="sr-only" onChange={onFile} aria-label="Escolher imagem de avatar" tabIndex={-1} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={updateAvatar.isPending}
          className="h-10 rounded-[2px] bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60"
        >
          {updateAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </button>
        {user.avatarUrl && (
          <button type="button" onClick={remove} disabled={updateAvatar.isPending} className="text-sm hover:text-highlight">
            Remover
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function ProfilePage() {
  const profile = useProfile()
  if (profile.error && !profile.data) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  if (!profile.data) return <Skeleton className="h-[500px] w-full bg-card" aria-label="Carregando perfil" />
  return <ProfileForm user={profile.data} />
}

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<ProfileInput>(() => toForm(user))
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const set = (key: keyof ProfileInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))
  const setPw = (key: keyof typeof passwords) => (e: { target: { value: string } }) =>
    setPasswords((p) => ({ ...p, [key]: e.target.value }))

  const wantsPasswordChange = Boolean(passwords.currentPassword || passwords.newPassword || passwords.confirm)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsedProfile = profileInput.safeParse(values)
    const nextErrors = parsedProfile.success ? {} : issuesToErrors(parsedProfile.error.issues)
    if (wantsPasswordChange) {
      const parsedPw = passwordChangeInput.safeParse(passwords)
      if (!parsedPw.success) Object.assign(nextErrors, issuesToErrors(parsedPw.error.issues))
      if (passwords.newPassword !== passwords.confirm) nextErrors.confirm = 'As senhas não coincidem'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || !parsedProfile.success) {
      focusFirstError(formRef.current)
      return
    }
    try {
      const user = await updateProfile.mutateAsync(parsedProfile.data)
      setValues(toForm(user))
      if (wantsPasswordChange) {
        await changePassword.mutateAsync({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
        setPasswords({ currentPassword: '', newPassword: '', confirm: '' })
        toast.success('Perfil e senha atualizados.')
      } else {
        toast.success('Perfil atualizado.')
      }
    } catch (err) {
      const apiError = ApiError.from(err)
      setErrors(apiError.fieldErrors)
      setFormError(apiError.message)
      focusFirstError(formRef.current)
    }
  }

  const saving = updateProfile.isPending || changePassword.isPending

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
      <h1 className="text-base font-bold">Perfil do colecionador</h1>
      <div className="grid gap-6 md:grid-cols-2 md:gap-x-7">
        <TextField label="Nome de exibição" required value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
        <TextField label="Nome de usuário" required value={values.username} onChange={set('username')} error={errors.username} autoComplete="username" />
        <TextField label="E-mail" type="email" required value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Field label="Nome ENS" error={errors.ensName} hint="Opcional. Letras minúsculas, números ou hífen.">
          {(a11y) => (
            <div className="flex gap-2">
              <span aria-hidden className="flex h-10 items-center rounded-[2px] border border-input px-3 text-sm">
                .eth
              </span>
              <input {...a11y} value={values.ensName} onChange={set('ensName')} className="h-10 min-w-0 flex-1 rounded-[2px] border border-input bg-transparent px-3 aria-invalid:border-destructive" />
            </div>
          )}
        </Field>
        <TextField label="Apelido da carteira" required value={values.walletNickname} onChange={set('walletNickname')} error={errors.walletNickname} />
        <AvatarEditor user={user} />
      </div>

      <fieldset className="flex max-w-[417px] flex-col gap-5">
        <legend className="mb-4 text-base font-bold">Alterar senha</legend>
        <PasswordField label="Senha atual" autoComplete="current-password" value={passwords.currentPassword} onChange={setPw('currentPassword')} error={errors.currentPassword} />
        <PasswordField label="Nova senha" autoComplete="new-password" value={passwords.newPassword} onChange={setPw('newPassword')} error={errors.newPassword} hint="Mínimo de 8 caracteres, com letras e números" />
        <PasswordField label="Confirmar nova senha" autoComplete="new-password" value={passwords.confirm} onChange={setPw('confirm')} error={errors.confirm} />
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <button type="submit" disabled={saving} className="h-10 w-fit rounded-[2px] bg-primary px-10 text-sm font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60">
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
