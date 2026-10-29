import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Eye, EyeOff, X } from 'lucide-react'
import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { notAvailable } from '@/app/layout/out-of-scope'
import { isPrivatePath } from '@/app/private-routes'
import { CatalogSection } from '@/features/catalog/components/catalog-section'
import { Hero } from '@/features/catalog/components/home-sections'
import { ApiError } from '@/shared/api/errors'
import { focusFirstError, issuesToErrors } from '@/shared/components/form-field'
import { loginInput, registerInput } from '@/shared/contracts'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { useLogin, useRegister } from '../hooks'
import { useLockedSubmit } from '@/shared/hooks/use-locked-submit'

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/'
  if (target.startsWith('/login') || target.startsWith('/register')) return '/'
  return target
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.4 1.2 4.9z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.6 3.4-4.6 6.3-4.6z"
      />
    </svg>
  )
}

/**
 * Auth input from the layout: no visible label (placeholder only), so the
 * label is kept for screen readers; errors appear right below.
 */
function AuthInput({
  label,
  error,
  hint,
  password,
  ...props
}: { label: string; error?: string; hint?: string; password?: boolean } & Omit<
  ComponentProps<'input'>,
  'className'
>) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={password ? (visible ? 'text' : 'password') : props.type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-[50px] w-full rounded-[10px] border border-border bg-transparent px-4 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none aria-invalid:border-destructive md:h-10 md:rounded-[5px]',
            password && 'pr-12',
          )}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-subtle hover:text-foreground"
          >
            {visible ? (
              <Eye aria-hidden className="size-[18px]" />
            ) : (
              <EyeOff aria-hidden className="size-[18px]" />
            )}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function SocialButtons() {
  const button =
    'flex h-10 items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] leading-4 font-medium text-muted-foreground hover:border-primary'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[13px] leading-4">
        <span className="h-px flex-1 bg-border" />
        Ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-4 md:gap-3 md:px-20">
        <button type="button" onClick={() => notAvailable('O login com Google')} className={button}>
          <GoogleIcon /> Continuar com Google
        </button>
        <button
          type="button"
          onClick={() => notAvailable('O login com Facebook')}
          className={button}
        >
          <span aria-hidden className="text-lg leading-none font-bold text-[#3b5999]">
            f
          </span>
          Continuar com Facebook
        </button>
      </div>
    </div>
  )
}

/** Home page rendered behind the desktop modal, as in the "Desktop / Login" frame. Inert. */
function HomeBackdrop() {
  return (
    <div inert aria-hidden className="pointer-events-none">
      <Hero />
      <CatalogSection search={{}} filtersOpen={false} onFiltersOpenChange={() => undefined} />
    </div>
  )
}

type ShellProps = {
  mode: 'login' | 'register'
  redirect: string | undefined
  description: string
  /** Mobile frames use a heading instead of the tabs. */
  mobileTitle: string
  children: ReactNode
}

function Shell({ mode, redirect, description, mobileTitle, children }: ShellProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // Closing must not reopen the login: a private redirect target (e.g. the
  // checkout) would bounce straight back here through the auth guard. Go back
  // to the page the user came from instead, or home on a direct visit.
  const close = () => {
    const target = safeRedirect(redirect)
    if (!isPrivatePath(target)) void navigate({ to: target })
    else if (router.history.canGoBack()) router.history.back()
    else void navigate({ to: '/' })
  }
  const tab = (active: boolean) =>
    cn(
      'text-xl leading-4 font-medium transition',
      active ? 'text-highlight' : 'text-foreground hover:text-highlight',
    )
  const tabs = (
    <nav aria-label="Entrar ou criar conta" className="flex items-center justify-center gap-2">
      <Link
        to="/login"
        search={{ redirect }}
        className={tab(mode === 'login')}
        aria-current={mode === 'login' ? 'page' : undefined}
      >
        Entrar
      </Link>
      <span aria-hidden className="h-5 w-px bg-destructive" />
      <Link
        to="/register"
        search={{ redirect }}
        className={tab(mode === 'register')}
        aria-current={mode === 'register' ? 'page' : undefined}
      >
        Criar conta
      </Link>
    </nav>
  )

  if (isDesktop) {
    return (
      <>
        <HomeBackdrop />
        {/* Figma "Sign In Modal": 500px wide, 160px from the top, 10px copper bottom border. */}
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent
            showCloseButton={false}
            overlayClassName="bg-black/25"
            className="top-[160px] max-h-[calc(100dvh-180px)] w-[500px] max-w-[calc(100vw-2rem)] translate-y-0 gap-0 overflow-y-auto rounded-none border-0 border-b-[10px] border-primary bg-card p-0 pt-12 pb-[46px] sm:max-w-[500px]"
          >
            <button
              type="button"
              aria-label="Fechar"
              onClick={close}
              className="absolute top-3 right-[22px] rounded p-1 text-highlight hover:bg-accent"
            >
              <X aria-hidden className="size-4" />
            </button>
            <DialogTitle className="sr-only">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </DialogTitle>
            {tabs}
            <DialogDescription className="mx-auto mt-10 max-w-[404px] text-center text-[13px] leading-4 text-foreground">
              {description}
            </DialogDescription>
            <div className="mt-6 flex flex-col gap-6">{children}</div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <section aria-labelledby="auth-title" className="flex flex-col px-7 pt-20 pb-6">
      <p
        aria-hidden
        className="flex h-[136px] items-center justify-center text-[32px] leading-[42px] font-bold tracking-[0.1em]"
      >
        KURIO
      </p>
      <h1 id="auth-title" className="mt-10 text-center text-xl leading-4 font-bold">
        {mobileTitle}
      </h1>
      <p className="sr-only">{description}</p>
      <div className="mt-10 flex flex-col gap-10">{children}</div>
    </section>
  )
}

export function LoginCard({ redirect, expired }: { redirect?: string; expired?: boolean }) {
  const navigate = useNavigate()
  const login = useLogin()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = useLockedSubmit(async () => {
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
  })

  return (
    <Shell
      mode="login"
      redirect={redirect}
      mobileTitle="Entrar"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
    >
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3 md:px-20">
        {expired && (
          <p role="status" className="rounded bg-band px-3 py-2 text-sm text-highlight">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}
        <AuthInput
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="contato@email.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={errors.email}
          required
        />
        <AuthInput
          label="Senha"
          password
          autoComplete="current-password"
          placeholder="Senha"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password}
          required
        />
        <button
          type="button"
          onClick={() => notAvailable('A recuperação de senha')}
          className="self-end text-sm leading-4 text-highlight hover:underline"
        >
          Esqueceu a senha?
        </button>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="mt-7 h-[60px] rounded-[10px] bg-primary text-base leading-4 font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60 md:mt-3 md:h-[45px] md:rounded-[5px]"
        >
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <SocialButtons />
      <p className="text-center text-[15px] leading-5 text-muted-foreground md:hidden">
        Novo na Kurio?{' '}
        <Link to="/register" search={{ redirect }} className="underline">
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

  const submit = useLockedSubmit(async () => {
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
  })

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <Shell
      mode="register"
      redirect={redirect}
      mobileTitle="Criar perfil de colecionador"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
    >
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3 md:px-20">
        <AuthInput
          label="Nome de usuário"
          autoComplete="username"
          placeholder="Nome de usuário"
          value={values.username}
          onChange={set('username')}
          error={errors.username}
          required
        />
        <AuthInput
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <AuthInput
          label="Senha"
          password
          autoComplete="new-password"
          placeholder="Senha"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="Mínimo de 8 caracteres, com letras e números"
          required
        />
        <AuthInput
          label="Confirmar senha"
          password
          autoComplete="new-password"
          placeholder="Confirmar senha"
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          required
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={register.isPending}
          className="mt-7 h-[60px] rounded-[10px] bg-primary text-base leading-4 font-bold text-primary-foreground hover:bg-highlight disabled:opacity-60 md:mt-3 md:h-[45px] md:rounded-[5px]"
        >
          {register.isPending ? (
            'Criando conta…'
          ) : (
            <>
              <span className="md:hidden">Criar perfil</span>
              <span className="hidden md:inline">Criar conta</span>
            </>
          )}
        </button>
      </form>
      <SocialButtons />
      <p className="text-center text-[15px] leading-5 text-muted-foreground md:hidden">
        Já tem uma conta?{' '}
        <Link to="/login" search={{ redirect }} className="underline">
          Entre
        </Link>
      </p>
    </Shell>
  )
}
