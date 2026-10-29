import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { notAvailable } from '@/app/layout/out-of-scope'
import { NftImage } from '@/shared/components/nft-image'
import type { NftSummary } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { useFeatured } from '../hooks'

function Dots({ count, active, onSelect }: { count: number; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex gap-2" role="tablist" aria-label="Destaques">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Destaque ${i + 1} de ${count}`}
          onClick={() => onSelect(i)}
          className={cn('size-2 rounded-full transition', i === active ? 'bg-highlight' : 'bg-primary/50 hover:bg-primary')}
        />
      ))}
    </div>
  )
}

export function Hero() {
  const { data, isPending } = useFeatured()
  const [index, setIndex] = useState(0)
  const items = data?.items ?? []
  const current: NftSummary | undefined = items[index % Math.max(items.length, 1)]

  return (
    <section aria-labelledby="hero-title" className="container-page grid items-center gap-8 pt-6 md:grid-cols-[1fr_450px] md:pt-[18px]">
      <div className="relative flex flex-col gap-5 rounded-[28px] bg-card p-5 md:gap-6 md:rounded-none md:bg-transparent md:px-10 md:py-0">
        <p className="text-sm font-medium">Bem-vindo à Kurio</p>
        <h1 id="hero-title" className="text-[22px] leading-[1.35] font-bold uppercase md:text-[43px] md:leading-[1.65]">
          Seja dono do futuro <br className="hidden md:block" />
          da arte digital
        </h1>
        <p className="max-w-[540px] text-sm leading-[1.7] text-muted-foreground">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas
          e tenha uma parte da cultura da internet.
        </p>
        <div className="flex items-center justify-between">
          <a
            href="#mercado"
            className="inline-flex items-center gap-2 rounded-[4px] font-bold text-highlight md:bg-primary md:px-7 md:py-2.5 md:text-primary-foreground md:hover:bg-highlight"
          >
            EXPLORAR <ArrowRight aria-hidden className="size-4 md:hidden" />
          </a>
          {items.length > 1 && <Dots count={items.length} active={index} onSelect={setIndex} />}
        </div>
      </div>
      <div className="hidden md:block">
        {isPending || !current ? (
          <Skeleton className="aspect-square w-full rounded-[18px] bg-card" />
        ) : (
          <Link to="/nfts/$nftId" params={{ nftId: current.id }} aria-label={`Ver destaque: ${current.name}`}>
            <NftImage src={current.imageUrl} alt={current.name} sizes="450px" priority className="rounded-[18px]" />
          </Link>
        )}
      </div>
    </section>
  )
}

export function FeaturedSideCard() {
  const { data } = useFeatured()
  const nft = data?.items[1] ?? data?.items[0]
  if (!nft) return <Skeleton className="h-[360px] w-full bg-card" />
  return (
    <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="group flex flex-col gap-2 bg-card pt-4" aria-label={`NFT em destaque: ${nft.name}`}>
      <span className="px-3 text-2xl font-bold text-highlight">NFT EM DESTAQUE</span>
      <span className="px-8 text-[22px] font-bold">OFERTA LIMITADA</span>
      <NftImage src={nft.imageUrl} alt="" sizes="310px" className="rounded-[18px] transition group-hover:opacity-90" />
    </Link>
  )
}

const PROMOS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/assets/nfts/emerald-640.webp',
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/assets/nfts/ivory-640.webp',
    search: { collection: ['arte-digital' as const] },
  },
]

export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="container-page mt-16 grid gap-6 md:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center bg-card">
          <img src={promo.image} alt="" width={250} height={250} loading="lazy" className="aspect-square h-full w-full object-cover" />
          <div className="flex flex-col items-end gap-3 px-4 py-4 text-right">
            <h2 className="text-base font-bold">{promo.title}</h2>
            <p className="text-sm leading-[1.6] text-muted-foreground">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              hash="mercado"
              className="inline-flex items-center gap-1 rounded-[4px] bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground hover:bg-highlight"
            >
              Explorar <ArrowRight aria-hidden className="size-4" />
              <span className="sr-only">: {promo.title}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: 'ivory' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: 'emerald' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: 'sage' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: 'golden' },
]

/** Editorial content is out of scope: cards are static, "Ler mais" says so. */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-16 flex flex-col items-center gap-3">
      <h2 id="journal-title" className="text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="text-center text-sm text-muted-foreground">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <div className="mt-6 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col bg-card">
            <img src={`/assets/nfts/${post.image}-320.webp`} alt="" width={268} height={190} loading="lazy" className="h-[190px] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-xs text-muted-foreground">
                {post.date} | Leitura de {post.read} min
              </p>
              <h3 className="text-base font-bold">{post.title}</h3>
              <p className="text-xs text-muted-foreground">{post.text}</p>
              <button type="button" onClick={() => notAvailable('O conteúdo editorial')} className="mt-auto self-start text-xs font-bold text-highlight hover:underline">
                Ler mais →<span className="sr-only">: {post.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
