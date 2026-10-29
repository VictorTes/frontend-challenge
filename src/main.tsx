import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

async function bootstrap() {
  // The app chunk downloads in parallel with the mock layer; rendering waits
  // for MSW so the first requests are already intercepted. (socket.io-client
  // is imported lazily by the realtime provider, after MSW patched WebSocket.)
  const appModule = import('./app/app')
  // The mock layer is enabled by configuration and also ships in the demo build.
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { App } = await appModule
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
