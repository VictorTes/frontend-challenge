#!/usr/bin/env node
/**
 * Downloads the NFT artwork used in the Figma file and writes responsive WebP
 * variants to public/assets/nfts. The output is committed, so running this is
 * only needed to refresh assets. Requires FIGMA_TOKEN (env or .env.local).
 *
 *   node scripts/sync-figma-assets.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

const FILE_KEY = 'Ff0SksUi7UFtPWUO8kyNtw'
/** Figma imageRef prefix → artwork slug used by the mock catalog. */
const ARTWORK = {
  '84592047': 'emerald',
  '2986a7cb': 'sage',
  '9df2ff42': 'ivory',
  '87580f2d': 'golden',
}
const WIDTHS = [320, 480, 640, 960]
/** Small variants (picked by phones via srcset) trade a little quality for weight. */
const QUALITY = { 320: 70, 480: 68, 640: 78, 960: 78 }
const OUT = 'public/assets/nfts'

function token() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN
  if (existsSync('.env.local')) {
    const line = readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('FIGMA_TOKEN='))
    if (line) return line.slice('FIGMA_TOKEN='.length).trim()
  }
  throw new Error('FIGMA_TOKEN not set (env or .env.local)')
}

const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/images`, {
  headers: { 'X-Figma-Token': token() },
})
if (!res.ok) throw new Error(`Figma API ${res.status}`)
const { meta } = await res.json()

mkdirSync(OUT, { recursive: true })
for (const [ref, url] of Object.entries(meta.images)) {
  const slug = ARTWORK[ref.slice(0, 8)]
  if (!slug) continue
  const source = Buffer.from(await (await fetch(url)).arrayBuffer())
  for (const width of WIDTHS) {
    const file = `${OUT}/${slug}-${width}.webp`
    await sharp(source).resize(width, width).webp({ quality: QUALITY[width] }).toFile(file)
    console.log('wrote', file)
  }
}
