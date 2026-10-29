export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Smooth in-page scroll for plain `#anchor` links (instant with reduced motion). */
export function smoothScrollTo(id: string, event?: { preventDefault(): void }) {
  const target = document.getElementById(id)
  if (!target) return
  event?.preventDefault()
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

/**
 * Shared-element transition: before navigating from a card to its NFT page,
 * give the clicked card's artwork the `vt-hero` name (styles.css) so the View
 * Transition morphs it into the detail image. Names must be unique per
 * snapshot, so any previous holder (e.g. the current detail image when a
 * related NFT is clicked) loses it first.
 */
export function installSharedArtworkTransitions(): () => void {
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const link = (event.target as Element | null)?.closest?.('a[href^="/nfts/"]')
    const image = link?.closest('[data-vt-card]')?.querySelector('img')
    if (!image) return
    document.querySelectorAll('.vt-hero').forEach((el) => el.classList.remove('vt-hero'))
    image.classList.add('vt-hero')
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
