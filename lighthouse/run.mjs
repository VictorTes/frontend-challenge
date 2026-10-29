#!/usr/bin/env node
/**
 * Builds nothing: run `npm run build` first (the `lighthouse` npm script does).
 * Serves dist/ with `vite preview`, audits each page/profile N times with the
 * mocks enabled (the demo build), writes HTML/JSON reports and a median summary.
 *
 *   npm run lighthouse
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { auditConfig } from './config.mjs'

const OUT = 'lighthouse/reports'
const BASE = `http://localhost:${auditConfig.port}`

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server did not start at ${url}`)
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(auditConfig.port), '--strictPort'], {
  stdio: 'ignore',
  shell: true,
})
let chrome
try {
  await waitForServer(BASE)
  mkdirSync(OUT, { recursive: true })
  chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-first-run'] })
  const results = []

  for (const page of auditConfig.pages) {
    for (const [profile, config] of Object.entries(auditConfig.profiles)) {
      const runs = []
      for (let i = 1; i <= auditConfig.runs; i++) {
        const result = await lighthouse(
          `${BASE}${page.path}`,
          { port: chrome.port, output: ['html', 'json'], onlyCategories: auditConfig.categories, logLevel: 'error' },
          config,
        )
        const [html, json] = result.report
        const file = `${OUT}/${page.name}-${profile}-run${i}`
        writeFileSync(`${file}.html`, html)
        writeFileSync(`${file}.json`, json)
        const lhr = result.lhr
        const run = {
          scores: Object.fromEntries(auditConfig.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
          lcpMs: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbtMs: lhr.audits['total-blocking-time'].numericValue,
          lighthouseVersion: lhr.lighthouseVersion,
          userAgent: lhr.environment.hostUserAgent,
        }
        runs.push(run)
        console.log(page.name, profile, `run ${i}`, run.scores, `LCP ${Math.round(run.lcpMs)}ms CLS ${run.cls.toFixed(3)} TBT ${Math.round(run.tbtMs)}ms`)
      }
      results.push({
        page: page.name,
        path: page.path,
        profile,
        median: {
          ...Object.fromEntries(auditConfig.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
          lcpMs: Math.round(median(runs.map((r) => r.lcpMs))),
          cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
          tbtMs: Math.round(median(runs.map((r) => r.tbtMs))),
        },
        runs,
      })
    }
  }

  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const summary = {
    generatedAt: new Date().toISOString(),
    environment: {
      lighthouse: results[0]?.runs[0]?.lighthouseVersion,
      chrome: results[0]?.runs[0]?.userAgent,
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      app: `${pkg.name}@${pkg.version}`,
      conditions: 'vite preview of the production build on localhost, mocks enabled (VITE_ENABLE_MOCKS=true), default mock scenario, Lighthouse simulated throttling, headless Chrome, fresh profile per run',
    },
    targets: auditConfig.targets,
    results: results.map(({ runs: _runs, ...r }) => r),
  }
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2))

  const rows = results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${r.median.lcpMs} | ${r.median.cls} | ${r.median.tbtMs} |`,
  )
  writeFileSync(
    `${OUT}/summary.md`,
    [
      `# Lighthouse — medianas de ${auditConfig.runs} execuções`,
      '',
      `Gerado em ${summary.generatedAt}. Lighthouse ${summary.environment.lighthouse}; ${summary.environment.chrome}; Node ${summary.environment.node}; ${summary.environment.os}; ${summary.environment.cpu}.`,
      '',
      `Condições: ${summary.environment.conditions}.`,
      '',
      '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...rows,
      '',
    ].join('\n'),
  )
  console.log(`\nSummary written to ${OUT}/summary.md`)
} finally {
  await chrome?.kill()
  // `vite preview` runs under a shell: kill the whole tree synchronously so no
  // stale server keeps port 4173 (Playwright would otherwise test an old build).
  if (process.platform === 'win32' && preview.pid) spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore' })
  else preview.kill()
}
