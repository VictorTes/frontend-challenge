import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useRelated } from '@/features/catalog/hooks'
import { NftImage } from '@/shared/components/nft-image'
import { formatEth } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'

const PAGES = 3

/** Horizontal, scroll-snapping list with the layout's pagination dots. */
export function RelatedCarousel({ nftId, title }: { nftId: string; title: string }) {
  const { data, isPending } = useRelated(nftId)
  const listRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)

  const goTo = (index: number) => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ left: ((list.scrollWidth - list.clientWidth) * index) / (PAGES - 1), behavior: 'smooth' })
  }

  const onScroll = () => {
    const list = listRef.current
    if (!list || list.scrollWidth <= list.clientWidth) return
    setPage(Math.round((list.scrollLeft / (list.scrollWidth - list.clientWidth)) * (PAGES - 1)))
  }

  return (
    <section aria-labelledby={`related-${nftId}`} className="mt-16 md:mt-20">
      <h2 id={`related-${nftId}`} className="border-b border-border pb-2 text-base font-bold text-highlight">
        {title}
      </h2>
      <ul ref={listRef} onScroll={onScroll} className="mt-7 flex snap-x gap-6 overflow-x-auto pb-2 [scrollbar-width:none]">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[180px] shrink-0 md:w-[218px]">
                <Skeleton className="aspect-[218/254] w-full bg-card" />
              </li>
            ))
          : data?.items.map((nft) => (
              <li key={nft.id} className="w-[180px] shrink-0 snap-start md:w-[218px]">
                <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="group flex flex-col gap-2">
                  <div className="bg-card p-4">
                    <NftImage src={nft.imageUrl} alt="" sizes="218px" className="transition group-hover:opacity-90" />
                  </div>
                  <span className="group-hover:text-highlight">{nft.name}</span>
                  <span className="font-bold text-highlight">{formatEth(nft.priceEth)}</span>
                </Link>
              </li>
            ))}
      </ul>
      <div className="mt-4 hidden justify-center md:flex">
        {Array.from({ length: PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para o grupo ${i + 1}`}
            aria-pressed={page === i}
            onClick={() => goTo(i)}
            className="flex size-6 items-center justify-center"
          >
            <span className={cn('size-3 rounded-full border border-highlight', page === i && 'bg-highlight')} />
          </button>
        ))}
      </div>
    </section>
  )
}
