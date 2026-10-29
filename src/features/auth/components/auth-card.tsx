import { Link, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { notAvailable } from '@/app/layout/out-of-scope'
import { ApiError } from '@/shared/api/errors'
import { focusFirstError, issuesToErrors, PasswordField, TextField } from '@/shared/components/form-field'
import { loginInput, registerInput } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useLogin, useRegister } from '../hooks'

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/login') || target.startsWith('/register')) return '/'
  return target
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.4 1.2 4.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.6 3.4-4.6 6.3-4.6z" />
    </svg>
  )
}

function SocialButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="h-px flex-1 bg-border" />
        Ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={() => notAvailable('O login com Google')}
        className="flex h-10 items-center justify-center gap-2 rounded-[2px] border border-border text-sm text-muted-foreground hover:border-primary"
      >
        <GoogleIcon /> Continuar com Google
      </button>
      <button
        type="button"
        onClick={() => notAvailable('O login com Facebook')}
        className="flex h-10 items-center justify-center gap-2 rounded-[2px] border border-border text-sm text-muted-foreground hover:border-primary"
      >
        <span aria-hidden className="text-lg font-bold text-[#3b5999]">
          f
        </span>
        Continuar com Facebook
      </button>
    </div>
  )
}

function Shell({
  mode,
  redirect,
  children,
}: {
  mode: 'login' | 'register'
  redirect: string | undefined
  children: ReactNode
}) {
  const navigate = useNavigate()
  const tabClass = (active: boolean) =>
    cn('text-xl transition md:text-xl', active ? 'font-medium text-highlight' : 'text-foreground hover:text-highlight')
  return (
    <div className="flex justify-center px-4 py-10 md:min-h-[70vh] md:items-center md:bg-black/40 md:py-16">
      <section
        aria-labelledby="auth-title"
        className="relative w-full max-w-[500px] md:border-b-[10px] md:border-primary md:bg-card md:px-20 md:pt-12 md:pb-14"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => navigate({ to: safeRedirect(redirect) })}
          className="absolute top-3 right-3 hidden rounded p-1 text-highlight hover:bg-accent md:block"
        >
          <X aria-hidden className="size-5" />
        </button>
        <p className="mb-16 text-center text-[32px] font-bold tracking-[0.12em] md:hidden">KURIO</p>
        <h1 id="auth-title" className="sr-only">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>
        <nav aria-label="Entrar ou criar conta" className="mb-6 flex items-center justify-center gap-2">
          <Link to="/login" search={{ redirect }} className={tabClass(mode === 'login')} aria-current={mode === 'login' ? 'page' : undefined}>
            Entrar
          </Link>
          <span aria-hidden className="h-6 w-px bg-primary" />
          <Link
            to="/register"
            search={{ redirect }}
            className={tabClass(mode === 'register')}
            aria-current={mode === 'register' ? 'page' : undefined}
          >
            Criar conta
          </Link>
        </nav>
        {children}
      </section>
    </div>
  )
}

export function LoginCard({ redirect, expired }: { redirect?: string; expired?: boolean }) {
  const navigate = useNavigate()
  const login = useLogin()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = loginInput.safeParse(values)
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues))
      focusFirstError(formRef.current)
      return
    }
    setErrors({})
    try {
      await login.mutateAsync(parsed.data)
      void navigate({ to: safeRedirect(redirect) })
    } catch (error) {
      const apiError = ApiError.from(error)
      setErrors(apiError.fieldErrors)
      setFormError(apiError.message)
    }
  }

  return (
    <Shell mode="login" redirect={redirect}>
      <p className="mb-6 text-center text-sm">Entre para gerenciar sua carteira, coleção e perfil de criador.</p>
      {expired && (
        <p role="status" className="mb-4 rounded bg-band px-3 py-2 text-sm text-highlight">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="contato@email.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={errors.email}
          required
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password}
          required
        />
        <button type="button" onClick={() => notAvailable('A recuperação de senha')} className="self-end text-sm text-highlight hover:underline">
          Esqueceu a senha?
        </button>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" disabled={login.isPending} className="mt-2">
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="mt-6">
        <SocialButtons />
      </div>
      <p className="mt-8 text-center text-muted-foreground md:hidden">
        Novo na Kurio?{' '}
        <Link to="/register" search={{ redirect }} className="text-highlight hover:underline">
          Crie uma conta
        </Link>
      </p>
    </Shell>
  )
}

export function RegisterCard({ redirect }: { redirect?: string }) {
  const navigate = useNavigate()
  const register = useRegister()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = registerInput.safeParse(values)
    const nextErrors = parsed.success ? {} : issuesToErrors(parsed.error.issues)
    if (values.confirm !== values.password) nextErrors.confirm = 'As senhas não coincidem'
    if (!parsed.success || Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      focusFirstError(formRef.current)
      return
    }
    setErrors({})
    try {
      await register.mutateAsync(parsed.data)
      void navigate({ to: safeRedirect(redirect) })
    } catch (error) {
      const apiError = ApiError.from(error)
      setErrors(apiError.fieldErrors)
      setFormError(apiError.message)
      focusFirstError(formRef.current)
    }
  }

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <Shell mode="register" redirect={redirect}>
      <p className="mb-6 text-center text-sm">Crie seu perfil de colecionador e conecte uma carteira quando quiser.</p>
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="Nome de usuário" autoComplete="username" value={values.username} onChange={set('username')} error={errors.username} hint="Letras minúsculas, números ou _" required />
        <TextField label="E-mail" type="email" autoComplete="email" placeholder="Digite seu e-mail" value={values.email} onChange={set('email')} error={errors.email} required />
        <PasswordField label="Senha" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint="Mínimo de 8 caracteres, com letras e números" required />
        <PasswordField label="Confirmar senha" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} required />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" disabled={register.isPending} className="mt-2">
          {register.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <div className="mt-6">
        <SocialButtons />
      </div>
      <p className="mt-8 text-center text-muted-foreground md:hidden">
        Já tem uma conta?{' '}
        <Link to="/login" search={{ redirect }} className="text-highlight hover:underline">
          Entre
        </Link>
      </p>
    </Shell>
  )
}
