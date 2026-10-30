import { Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from '@/shared/components/brand-icons'
import { collectionLabels, type CollectionSlug } from '@/shared/contracts'
import { notAvailable } from './out-of-scope'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

/**
 * Footer entries that exist in the app navigate; the rest (editorial, support,
 * activity) are out of scope and say so via `notAvailable`.
 */
type FooterLink =
  | string
  | { label: string; to: '/account/profile' | '/account/favorites' }
  | { label: string; collection: CollectionSlug }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/account/profile' },
      'Minha coleção',
      'Atividade',
      'Estúdio do criador',
      { label: 'Lista de interesse', to: '/account/favorites' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      'Central de ajuda',
      'Como comprar NFTs',
      'Carteira e segurança',
      'Política do mercado',
      'Denunciar item',
    ],
  },
  {
    title: 'Coleções',
    links: (['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade'] as const).map(
      (collection) => ({
        label: collectionLabels[collection],
        collection,
      }),
    ),
  },
]

const SOCIAL = [
  { label: 'Facebook', icon: FacebookIcon },
  { label: 'Instagram', icon: InstagramIcon },
  { label: 'Twitter', icon: TwitterIcon },
  { label: 'LinkedIn', icon: LinkedinIcon },
  { label: 'YouTube', icon: YoutubeIcon },
]

/** "METAMASK • WALLETCONNECT • COINBASE" chip (Figma: 26px tall, #38220f, border #55321f). */
export function WalletsBadge() {
  return (
    <span className="inline-flex h-[26px] items-center gap-[10px] rounded-[6px] border border-[#55321f] bg-band px-2 text-[9px] leading-3 font-bold tracking-[0.01em] whitespace-nowrap text-highlight">
      METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
    </span>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    notAvailable('A newsletter')
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 lg:min-w-0 lg:flex-[1.35] lg:px-4 xl:w-[357px] xl:flex-none"
    >
      <h2 className="text-lg leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="mt-1 flex h-10 overflow-hidden rounded-[6px] bg-band">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para novidades
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="digite seu e-mail..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 bg-transparent pl-3 text-sm placeholder:text-subtle focus:outline-none"
        />
        <button
          type="submit"
          className="w-[85px] bg-primary text-lg leading-4 font-bold text-primary-foreground hover:bg-highlight"
        >
          Enviar
        </button>
      </div>
      <p className="text-[13px] leading-[22px] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="container-page mt-24 mb-28 md:mb-6">
      {/* Features + newsletter (Figma: 1200×250, padding 32) */}
      {/* Below lg (no frame): icon beside the text and dividers between items,
          so the three features read as a compact list instead of a tall column. */}
      <div className="flex flex-col gap-6 bg-card p-6 sm:p-8 lg:min-h-[250px] lg:flex-row lg:gap-0">
        {FEATURES.map((f) => (
          <div
            key={f.letter}
            className="flex items-start gap-4 border-b border-primary/25 pb-6 lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-3 lg:border-r lg:border-b-0 lg:border-primary lg:px-4 lg:pb-0 xl:w-[265px] xl:flex-none"
          >
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg leading-8 font-bold text-primary-foreground lg:size-[74px] lg:text-2xl"
            >
              {f.letter}
            </span>
            <div className="flex flex-col gap-2 lg:gap-3">
              <h2 className="text-base leading-5 font-bold lg:text-[17px] lg:leading-4">{f.title}</h2>
              <p className="text-sm leading-[22px] text-muted-foreground lg:max-w-[204px]">{f.text}</p>
            </div>
          </div>
        ))}
        <Newsletter />
      </div>
      {/* Contact band (Figma: 88px, #38220f) */}
      <div className="grid gap-2 bg-band p-6 text-sm leading-[22px] sm:grid-cols-2 sm:gap-4 sm:p-8 lg:items-center xl:grid-cols-[211px_230px_211px_1fr] xl:gap-[81px]">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <span className="lg:whitespace-pre-line">
          {'Feito para colecionadores,\ncriadores e cultura'}
        </span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>
      {/* Link columns (Figma: 236px, gap 124) */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 bg-card p-6 sm:p-8 lg:grid-cols-[179px_179px_179px_228px] lg:justify-between lg:gap-0">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
            <h2 className="text-base leading-5 font-bold lg:text-lg lg:leading-4">{col.title}</h2>
            <ul className="flex flex-col gap-2.5 text-sm leading-5 lg:block lg:leading-[30px]">
              {col.links.map((link) => (
                <li key={typeof link === 'string' ? link : link.label}>
                  {typeof link === 'string' ? (
                    <button
                      type="button"
                      onClick={() => notAvailable(link)}
                      className="text-left hover:text-highlight"
                    >
                      {link}
                    </button>
                  ) : 'to' in link ? (
                    <Link to={link.to} className="hover:text-highlight">
                      {link.label}
                    </Link>
                  ) : (
                    <Link
                      to="/"
                      search={{ collection: [link.collection] }}
                      hash="mercado"
                      className="hover:text-highlight"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="col-span-2 flex flex-col gap-8 lg:col-span-1">
          <div className="flex flex-col gap-5">
            <h2 className="text-lg leading-4 font-bold">Redes sociais</h2>
            <ul className="flex gap-[10px]">
              {SOCIAL.map(({ label, icon: Icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() => notAvailable(`O perfil no ${label}`)}
                    className="flex size-[30px] items-center justify-center rounded-[4px] border border-primary text-highlight hover:bg-primary/10"
                  >
                    <Icon className="size-[14px]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg leading-4 font-bold">Carteiras compatíveis</h2>
            <WalletsBadge />
          </div>
        </div>
      </div>
      <p className="text-center text-sm leading-[30px]">
        © 2026 Kurio. Propriedade digital para todos.
      </p>
    </footer>
  )
}
