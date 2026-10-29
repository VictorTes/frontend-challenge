import { FlaskConical, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type MockState = { scenarios: string[]; available: Record<string, string> }

/**
 * Demo-only panel (rendered when VITE_ENABLE_MOCKS=true) to pick mock
 * scenarios and reset the simulated backend. It only talks to the mock
 * control API; it never feeds data or events to the app directly.
 */
export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MockState | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    void fetch('/api/__mock/state')
      .then((r) => r.json() as Promise<MockState>)
      .then((s) => {
        setState(s)
        setSelected(s.scenarios.filter((n) => n !== 'default'))
      })
  }, [open])

  const apply = async (reset: boolean) => {
    const scenario = selected.join(',') || 'default'
    await fetch(`/api/__mock/${reset ? 'reset' : 'scenario'}`, {
      method: reset ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    })
    if (reset) {
      // A reset restores the seed: client storage from the old state is dropped too.
      for (const key of Object.keys(localStorage)) if (key.startsWith('kurio:')) localStorage.removeItem(key)
      sessionStorage.clear()
    }
    window.location.assign('/')
  }

  return (
    <div className="fixed bottom-24 left-3 z-50 md:bottom-4">
      {open ? (
        <section
          aria-label="Cenários de mock"
          className="w-[300px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Cenários de mock</h2>
            <button type="button" aria-label="Fechar painel" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {!state ? (
            <p role="status">Carregando…</p>
          ) : (
            <>
              <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                <legend className="sr-only">Cenários ativos</legend>
                {Object.entries(state.available)
                  .filter(([name]) => name !== 'default')
                  .map(([name, description]) => (
                    <label key={name} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-accent/50">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[var(--primary)]"
                        checked={selected.includes(name)}
                        onChange={(e) =>
                          setSelected((s) => (e.target.checked ? [...s, name] : s.filter((n) => n !== name)))
                        }
                      />
                      <span>
                        <code className="text-highlight">{name}</code>
                        <span className="block text-xs text-muted-foreground">{description}</span>
                      </span>
                    </label>
                  ))}
              </fieldset>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => apply(false)} className="flex-1 rounded-[4px] bg-primary px-3 py-1.5 font-bold text-primary-foreground">
                  Aplicar
                </button>
                <button type="button" onClick={() => apply(true)} className="flex-1 rounded-[4px] border border-primary px-3 py-1.5 text-highlight">
                  Resetar dados
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir painel de cenários de mock"
          className="flex size-10 items-center justify-center rounded-full border border-primary bg-card text-highlight shadow-lg hover:bg-accent"
        >
          <FlaskConical aria-hidden className="size-5" />
        </button>
      )}
    </div>
  )
}
