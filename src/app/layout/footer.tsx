import { useState, type FormEvent } from 'react'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/shared/components/brand-icons'
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

const COLUMNS: { title: string; links: string[] }[] = [
  { title: 'Meu perfil', links: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'] },
  {
    title: 'Central de ajuda',
    links: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'],
  },
  { title: 'Coleções', links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] },
]

const SOCIAL = [
  { label: 'Facebook', icon: FacebookIcon },
  { label: 'Instagram', icon: InstagramIcon },
  { label: 'Twitter', icon: TwitterIcon },
  { label: 'LinkedIn', icon: LinkedinIcon },
  { label: 'YouTube', icon: YoutubeIcon },
]

export function WalletsBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-[4px] border border-primary/60 bg-band px-2.5 py-1 text-[9px] font-bold tracking-[0.01em] text-highlight">
      METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
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
    <form onSubmit={submit} className="flex flex-col gap-4 lg:pl-4">
      <h2 className="text-lg leading-[1] font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para novidades
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="digite seu e-mail..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 min-w-0 flex-1 bg-[#2f1d15] px-3 text-sm placeholder:text-subtle"
        />
        <button type="submit" className="h-10 bg-primary px-4 font-bold text-primary-foreground hover:bg-highlight">
          Enviar
        </button>
      </div>
      <p className="text-sm leading-[1.6] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="container-page mt-20 mb-24 md:mb-6">
      <div className="grid gap-8 bg-card px-6 py-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
        {FEATURES.map((f) => (
          <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-primary lg:pr-6">
            <span aria-hidden className="flex size-[74px] items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {f.letter}
            </span>
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="text-sm leading-[1.6] text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <Newsletter />
      </div>
      <div className="grid gap-4 bg-band px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-8">
        <span className="font-bold tracking-[0.12em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="grid gap-8 bg-card px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">{col.title}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {col.links.map((link) => (
                <li key={link}>
                  <button type="button" onClick={() => notAvailable(link)} className="text-left hover:text-highlight">
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {SOCIAL.map(({ label, icon: Icon }) => (
              <li key={label}>
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => notAvailable(`O perfil no ${label}`)}
                  className="flex size-8 items-center justify-center rounded-[4px] border border-primary text-highlight hover:bg-primary/10"
                >
                  <Icon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <h2 className="text-lg font-bold">Carteiras compatíveis</h2>
          <WalletsBadge />
        </div>
      </div>
      <p className="py-5 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
