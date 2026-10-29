import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
/**
 * BASE_URL=https://<deploy>.vercel.app npm run test:e2e runs the suite against a
 * deployed build instead of starting `vite preview` locally.
 */
const REMOTE_URL = process.env.BASE_URL
const BASE_URL = REMOTE_URL ?? `http://localhost:${PORT}`

/**
 * E2E against the production build (vite preview) with the MSW mock layer
 * enabled, so tests exercise the same bundle that is deployed.
 * Each test gets a fresh browser context: empty storage => fresh mock seed.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      // Main flows also run at 390px (the README's minimum mobile width).
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'chromium-tablet',
      // Same main flows at 768px (filters in a sheet, desktop header). No visual baselines here.
      grep: /@mobile/,
      grepInvert: /Regressão visual/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
  webServer: REMOTE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: BASE_URL,
        // Always build and serve the current code: a stale server would test an old bundle.
        reuseExistingServer: false,
        timeout: 180_000,
      },
})
