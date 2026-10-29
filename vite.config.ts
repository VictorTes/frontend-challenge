import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * main.tsx loads the app and (when enabled) the mock layer with dynamic
 * imports, so the browser would only discover them after index.js ran.
 * Preloading them from the HTML downloads all three in parallel.
 */
function preloadBootChunks(withMocks: boolean): Plugin {
  const boot = [/src\/app\/app\.tsx$/, ...(withMocks ? [/src\/mocks\/browser\.ts$/] : [])]
  return {
    name: 'preload-boot-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = new Set<string>()
        for (const chunk of Object.values(ctx.bundle ?? {})) {
          if (chunk.type !== 'chunk' || !chunk.isDynamicEntry || !chunk.facadeModuleId) continue
          if (!boot.some((re) => re.test(chunk.facadeModuleId!.replace(/\\/g, '/')))) continue
          files.add(chunk.fileName)
          // Static imports of the boot chunk, minus what index.html already loads.
          for (const dep of chunk.imports) files.add(dep)
        }
        return [...files]
          .filter((file) => !ctx.chunk?.imports.includes(file) && file !== ctx.chunk?.fileName)
          .map((file) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${file}` }, injectTo: 'head' as const }))
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      preloadBootChunks(env.VITE_ENABLE_MOCKS === 'true'),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
  }
})
