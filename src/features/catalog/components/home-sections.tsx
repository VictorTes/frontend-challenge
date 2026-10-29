import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { notAvailable } from '@/app/layout/out-of-scope'
import { NftImage } from '@/shared/components/nft-image'
import type { NftSummary } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { useFeatured } from '../hooks'

function Dots({
  count,
  active,
  onSelect,
  className,
}: {
  count: number
  active: number
  onSelect: (i: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex', className)} role="group" aria-label="Destaques">
      {Array.from({ length: count }, (_, i) => (
        // 24px hit area around the 8px dot from the layout (WCAG 2.5.8).
        <button
          key={i}
          type="button"
          aria-pressed={i === active}
          aria-label={`Destaque ${i + 1} de ${count}`}
          onClick={() => onSelect(i)}
          className="group flex size-6 items-center justify-center"
        >
          <span
            className={cn(
              'size-2 rounded-full transition',
              i === active ? 'bg-primary' : 'bg-primary/45 group-hover:bg-primary',
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Desktop hero (Figma "Hero": 1200×450) and the compact mobile card. */
export function Hero() {
  const { data, isPending } = useFeatured()
  const [index, setIndex] = useState(0)
  const items = data?.items ?? []
  const current: NftSummary | undefined = items[index % Math.max(items.length, 1)]
  const secondary: NftSummary | undefined = items[(index + 1) % Math.max(items.length, 1)]

  return (
    <section aria-labelledby="hero-title" className="container-page pt-[22px] md:pt-8">
      {/* Mobile: rounded card with the artwork on the right (frame "Mobile / Início"). */}
      <div className="relative flex min-h-[190px] overflow-hidden rounded-[22px] bg-card md:hidden">
        <span
          aria-hidden
          className="absolute -top-16 left-[120px] size-[260px] rounded-full bg-[#2f1d15]"
        />
        <div className="relative z-10 flex w-[58%] flex-col gap-1.5 px-4 py-3">
          <p className="text-[13px] leading-[17px] font-bold">Bem-vindo à Kurio</p>
          <h1 id="hero-title-mobile" className="text-xl leading-[30px] font-bold uppercase">
            Seja dono da cultura digital
          </h1>
          <p className="text-[13px] leading-[17px] text-muted-foreground">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <a
            href="#mercado"
            className="mt-1 inline-flex items-center gap-2 text-[13px] font-bold text-highlight"
          >
            EXPLORAR <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
        <div className="relative z-10 ml-auto w-[42%] py-2.5 pr-3">
          {current && (
            <NftImage
              src={current.imageUrl}
              alt=""
              sizes="140px"
              priority
              className="rounded-[16px]"
            />
          )}
          {secondary && (
            <NftImage
              src={secondary.imageUrl}
              alt=""
              sizes="60px"
              className="absolute bottom-3 left-0 w-[58px] rounded-[10px] border-2 border-card"
            />
          )}
        </div>
        {items.length > 1 && (
          <Dots
            count={items.length}
            active={index}
            onSelect={setIndex}
            className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"
          />
        )}
      </div>

      {/* Desktop */}
      <div className="hidden grid-cols-[minmax(0,1fr)_260px] items-center gap-8 py-4 md:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:pl-10 xl:h-[450px] xl:grid-cols-[600px_450px] xl:gap-[110px] xl:py-0">
        <div className="flex flex-col gap-11">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-2">
                <p className="text-sm leading-4 font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
                <h1
                  id="hero-title"
                  className="text-[30px] leading-[48px] font-bold uppercase lg:text-[36px] lg:leading-[58px] xl:text-[43px] xl:leading-[70px]"
                >
                  Seja dono do futuro
                  <br />
                  da arte digital
                </h1>
              </div>
              <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte
                digital rara, apoie artistas e tenha uma parte da cultura da internet.
              </p>
            </div>
            <a
              href="#mercado"
              className="flex h-10 w-[140px] items-center justify-center rounded-[6px] bg-primary pr-2 text-base leading-5 font-bold text-primary-foreground hover:bg-highlight"
            >
              EXPLORAR
            </a>
          </div>
          {items.length > 1 && (
            <Dots count={items.length} active={index} onSelect={setIndex} className="self-end" />
          )}
        </div>
        <div className="aspect-square w-full">
          {isPending || !current ? (
            <Skeleton className="size-full rounded-[24px] bg-card" />
          ) : (
            <Link
              to="/nfts/$nftId"
              params={{ nftId: current.id }}
              aria-label={`Ver destaque: ${current.name}`}
            >
              <NftImage
                src={current.imageUrl}
                alt={current.name}
                sizes="450px"
                priority
                className="rounded-[24px]"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

/** "NFT EM DESTAQUE / OFERTA LIMITADA" banner below the filters (Figma: 310×470). */
export function FeaturedSideCard() {
  const { data } = useFeatured()
  const nft = data?.items[1] ?? data?.items[0]
  if (!nft) return <Skeleton className="h-[470px] w-full bg-card" />
  return (
    <Link
      to="/nfts/$nftId"
      params={{ nftId: nft.id }}
      className="group flex flex-col gap-4 bg-gradient-to-b from-card to-transparent pt-6 pb-1"
    >
      <span className="flex flex-col gap-4">
        <span className="px-5 text-2xl leading-8 font-bold text-highlight">
          NFT EM DESTAQUE<span className="sr-only">: {nft.name}</span>
        </span>
        <span className="px-5 text-[22px] leading-4 font-bold">OFERTA LIMITADA</span>
      </span>
      <img
        src={nft.imageUrl}
        alt=""
        width={310}
        height={368}
        loading="lazy"
        className="h-[368px] w-full rounded-[22px] object-cover transition group-hover:opacity-90"
      />
    </Link>
  )
}

const PROMOS = [
  {
    title: 'Lançamentos gênesis\nde edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/assets/nfts/emerald-640.webp',
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada\ne muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/assets/nfts/ivory-640.webp',
    search: { collection: ['arte-digital' as const] },
  },
]

/** Two promo cards (Figma: 586×250 each, gap 28). */
export function PromoBanners() {
  return (
    <section
      aria-label="Coleções em destaque"
      className="container-page mt-24 grid gap-7 lg:grid-cols-2"
    >
      {PROMOS.map((promo) => (
        <article
          key={promo.title}
          className="relative grid grid-cols-[minmax(0,292fr)_minmax(0,294fr)] overflow-hidden rounded-[8px] bg-card md:h-[250px]"
        >
          {/* Decorative arcs from the layout. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-[118px] -left-[191px] size-64 rounded-full border-2 border-primary"
          />
          <img
            src={promo.image}
            alt=""
            width={292}
            height={250}
            loading="lazy"
            className="relative h-full w-full rounded-[18px] object-cover"
          />
          {/* Figma: title at 37px, text at 94px, button at 164px; right padding 30. */}
          <div className="flex flex-col items-end pt-[37px] pr-[30px] pb-[46px] pl-1.5 text-right max-md:py-6">
            <h2 className="text-lg leading-6 font-bold whitespace-pre-line xl:whitespace-pre">
              {promo.title}
            </h2>
            <p className="mt-[9px] max-w-[263px] text-sm leading-6 text-muted-foreground">
              {promo.text}
            </p>
            <Link
              to="/"
              search={promo.search}
              hash="mercado"
              className="mt-auto flex h-10 w-[140px] shrink-0 items-center justify-center gap-1 rounded-[6px] bg-primary max-md:mt-4 text-sm leading-5 font-medium text-primary-foreground hover:bg-highlight"
            >
              Explorar <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.5} />
              <span className="sr-only">: {promo.title.replace('\n', ' ')}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  {
    date: '12 de setembro',
    read: 6,
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: 'ivory',
  },
  {
    date: '13 de setembro',
    read: 2,
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: 'emerald',
  },
  {
    date: '15 de setembro',
    read: 3,
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: 'sage',
  },
  {
    date: '15 de setembro',
    read: 2,
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: 'golden',
  },
]

/**
 * Editorial content is out of scope: cards are static, "Ler mais" says so.
 * Figma leaves a 56px gap after the 4th card; the columns fill the row here.
 */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-24 flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="journal-title" className="text-[28px] leading-[37px] font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col overflow-hidden rounded-[8px] bg-card">
            <img
              src={`/assets/nfts/${post.image}-640.webp`}
              alt=""
              width={282}
              height={195}
              loading="lazy"
              className="h-[195px] w-full object-cover"
            />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-xs leading-4 font-medium text-muted-foreground">
                {post.date}&nbsp;&nbsp;|&nbsp;&nbsp;Leitura de {post.read} min
              </p>
              <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
              <p className="text-xs leading-4 font-medium text-muted-foreground">{post.text}</p>
              <button
                type="button"
                onClick={() => notAvailable('O conteúdo editorial')}
                className="mt-auto self-start text-xs leading-4 font-bold text-highlight hover:underline"
              >
                Ler mais <span aria-hidden>→</span>
                <span className="sr-only">: {post.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
