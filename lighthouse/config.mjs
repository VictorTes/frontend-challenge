/**
 * Versioned Lighthouse audit configuration (README §10).
 * Pages × profiles × runs; the median of each category is reported.
 */
export const auditConfig = {
  port: 4173,
  runs: 3,
  pages: [
    { name: 'inicio', path: '/' },
    { name: 'detalhe', path: '/nfts/emerald-ape-042' },
  ],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  profiles: {
    // Lighthouse defaults: Moto G Power-class device, simulated slow 4G, 4x CPU slowdown.
    mobile: { extends: 'lighthouse:default' },
    // Lighthouse's desktop preset: 1350×940, simulated broadband, no CPU slowdown.
    desktop: {
      extends: 'lighthouse:default',
      settings: {
        formFactor: 'desktop',
        screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
        emulatedUserAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    },
  },
}
