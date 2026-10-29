/**
 * ETH amounts travel as decimal strings ("0.125") and are computed as bigint wei.
 * Never convert to `number`: 0.1 + 0.2 must stay 0.3.
 */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const DECIMAL_RE = /^\d+(\.\d+)?$/

export type EthString = string

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value) && (value.split('.')[1]?.length ?? 0) <= DECIMALS
}

export function toWei(eth: EthString): bigint {
  if (!isEthString(eth)) throw new Error(`Invalid ETH amount: "${eth}"`)
  const [int = '0', frac = ''] = eth.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: EthString[]): EthString {
  return fromWei(values.reduce((sum, v) => sum + toWei(v), 0n))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity)) throw new Error('Quantity must be an integer')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentage discount, rounded down to the wei. */
export function percentOf(value: EthString, percent: number): EthString {
  if (!Number.isInteger(percent)) throw new Error('Percent must be an integer')
  return fromWei((toWei(value) * BigInt(percent)) / 100n)
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

/**
 * Display with 2 to `maxFractionDigits` decimals, truncating extra digits
 * (a price is never rounded up). Example: "1.19" → "1.19 ETH", "26.846" → "26.846 ETH".
 */
export function formatEth(value: EthString, maxFractionDigits = 4, unit = true): string {
  const negative = value.startsWith('-')
  const [int = '0', frac = ''] = value.replace('-', '').split('.')
  const shown = frac.slice(0, maxFractionDigits).replace(/0+$/, '').padEnd(2, '0')
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${intFormatted}.${shown}${unit ? ' ETH' : ''}`
}

/** Centi-ETH integer <-> decimal string, for UI controls such as sliders. */
export function centiToEth(centi: number): EthString {
  return fromWei(BigInt(Math.round(centi)) * 10n ** 16n)
}

export function ethToCenti(value: EthString): number {
  return Number(toWei(value) / 10n ** 16n)
}
