import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

async function bootstrap() {
  // The mock layer is enabled by configuration and also ships in the demo build.
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  // Imported only after MSW patched WebSocket: engine.io-client captures the
  // global WebSocket constructor when its module is evaluated.
  const { App } = await import('./app/app')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
