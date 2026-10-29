import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import type { ComponentType } from 'react'
import { notAvailable } from '@/app/layout/out-of-scope'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/shared/lib/utils'

type Item =
  | { label: string; icon: ComponentType<{ className?: string }>; to: '/account/profile' | '/account/wallets' | '/account/favorites' }
  | { label: string; icon: ComponentType<{ className?: string }>; feature: string }

const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: User, to: '/account/profile' },
  { label: 'Carteiras', icon: MapPin, to: '/account/wallets' },
  { label: 'Atividade', icon: ShoppingCart, feature: 'O histórico de atividade' },
  { label: 'Lista de interesse', icon: Heart, to: '/account/favorites' },
  { label: 'Ofertas', icon: LineChart, feature: 'A área de ofertas' },
  { label: 'Arquivos baixados', icon: Download, feature: 'A área de downloads' },
  { label: 'Suporte', icon: AlertTriangle, feature: 'O suporte' },
]

export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()
  const itemClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 border-l-[6px] px-3 py-2.5 text-[15px] text-highlight transition hover:bg-accent/50',
      active ? 'border-primary' : 'border-transparent',
    )

  return (
    <div className="container-page grid gap-7 pt-6 md:pt-8 lg:grid-cols-[310px_1fr]">
      <nav aria-label="Meu perfil" className="h-fit bg-card pt-4">
        <p className="px-3 pb-2 text-lg font-bold">Meu perfil</p>
        <ul className="flex gap-1 overflow-x-auto lg:block">
          {ITEMS.map((item) => (
            <li key={item.label} className="shrink-0">
              {'to' in item ? (
                <Link to={item.to} className={itemClass(pathname.startsWith(item.to))} aria-current={pathname.startsWith(item.to) ? 'page' : undefined}>
                  <item.icon aria-hidden className="size-4" /> {item.label}
                </Link>
              ) : (
                <button type="button" onClick={() => notAvailable(item.feature)} className={itemClass(false)}>
                  <item.icon aria-hidden className="size-4" /> {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}
          className="flex w-full items-center gap-3 border-t border-border px-4 py-3 font-bold text-highlight hover:bg-accent/50"
        >
          <LogOut aria-hidden className="size-4" /> Sair
        </button>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
