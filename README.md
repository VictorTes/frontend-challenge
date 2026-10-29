# Kurio — Marketplace de NFTs

Solução do desafio frontend ([enunciado original](docs/CHALLENGE.md)): marketplace de NFTs em React + TypeScript, fiel ao [layout do Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1), com API REST e tempo real simulados na camada de rede (MSW + Socket.IO).

- **Stack:** React 19, TypeScript, TanStack Router, TanStack Query, Axios, Socket.IO (`socket.io-client`), Tailwind CSS v4, shadcn/ui (Radix), MSW 2 + `@mswjs/socket.io-binding`, Playwright, Lighthouse, Vite 8 e zod.
- **Arquitetura, contratos REST/eventos, sessão, carrinho, cache e desvios do Figma:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Decisões técnicas:** [DECISIONS.md](DECISIONS.md)
- **Demo publicada:** https://frontend-challenge-ivory-iota.vercel.app

## Requisitos

- Node.js 20+ (testado com 22.22) e npm 10+
- Chrome ou Chromium para a auditoria Lighthouse (`chrome-launcher` usa o Chrome instalado)

## Setup e execução

```bash
npm ci
npm run dev          # http://localhost:5173 — desenvolvimento com mocks
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com MSW (REST e Socket.IO simulados) |
| `npm run build` | Gera as rotas, faz a verificação de tipos e o build de produção em `dist/` (com mocks) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc` em modo estrito |
| `npm run lint` | ESLint (TypeScript + React Hooks) |
| `npm run test:e2e` | Playwright: build, preview e testes desktop + mobile (relatório em `playwright-report/`) |
| `npm run test:e2e:update` | Regenera as baselines de regressão visual |
| `npm run lighthouse` | Build e auditoria Lighthouse: 3 execuções por página e perfil, mediana em `lighthouse/reports/summary.md` |

Na primeira execução dos testes, instale o navegador do Playwright: `npx playwright install chromium`.

## Variáveis de ambiente

Os valores padrão estão em `.env` (versionado, sem segredos). Para sobrescrever localmente, use `.env.local` (ignorado pelo Git).

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Também vale para o build de demonstração |
| `VITE_API_URL` | `/api` | Base da API REST (interceptada pelo MSW) |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Endpoint Socket.IO (interceptado pelo MSW) |

`FIGMA_TOKEN` (opcional, só em `.env.local`) é usado apenas por `node scripts/sync-figma-assets.mjs` para reexportar as artes do Figma. Os assets já estão versionados em `public/assets`.

## Credenciais fictícias

| Usuário | E-mail | Senha | Dados |
| --- | --- | --- | --- |
| Alice | `alice@kurio.test` | `Kurio@2026` | 2 carteiras (principal Ethereum, secundária Polygon), 2 favoritos |
| Bruno | `bruno@kurio.test` | `Kurio@2026` | sem carteiras, 1 favorito |

Cupons: `KURIO10` (10%), `GENESIS25` (25%), `VERAO20` (expirado). Qualquer outro código é inválido.

## Cenários de mock: seleção e reset

O estado do backend simulado persiste no `localStorage` (sobrevive a refresh). Há três formas de controlá-lo:

1. **URL:** `?scenario=nome` ou vários combinados, por exemplo `/?scenario=slow,payment-declined`. A escolha fica persistida até mudar.
2. **Painel:** o botão de frasco no canto inferior esquerdo (só com mocks ativos) permite marcar cenários, **Aplicar** ou **Resetar dados** (restaura o seed e limpa sessão e carrinho locais).
3. **Console:** o objeto `kurioMock` altera o *servidor* simulado; o app só vê o efeito via REST e Socket.IO.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência fixa de 120ms |
| `empty` | Busca do catálogo sempre vazia |
| `slow` | Toda requisição leva 2.5s (skeletons) |
| `variable-latency` | Latência cíclica: 100ms, 1.2s, 400ms |
| `out-of-order` | Requisições ímpares do catálogo demoram mais que as pares |
| `offline` | Toda requisição REST falha por rede |
| `server-error` | Catálogo e detalhe respondem HTTP 500 |
| `flaky` | As 2 primeiras requisições de catálogo e detalhe respondem 503, depois recuperam |
| `favorites-error` | Favoritar ou desfavoritar responde 500 (rollback otimista) |
| `session-expired` | Sessões expiram 30s após o login |
| `price-change-on-checkout` | O preço do 1º item sobe ao enviar o pedido (409 `QUOTE_STALE`) |
| `sold-out-on-checkout` | O 1º item esgota ao enviar o pedido |
| `order-timeout` | O 1º pedido é criado, mas a resposta não chega antes do timeout do cliente (10s) |
| `payment-declined` | O pagamento é recusado |
| `payment-slow` | O pagamento fica pendente por 20s |
| `wallet-rejected` | A conexão da carteira é recusada |

Helpers de console:

```js
kurioMock.setPrice('emerald-ape-042', 'emerald-ape-042-1of50', '1.5') // emite nft.updated
kurioMock.setStock('emerald-ape-042', 'emerald-ape-042-1of50', 0)
kurioMock.events()                // últimos eventos emitidos
kurioMock.replay('evt-1')         // reenvia (duplicado ou antigo)
kurioMock.dropSockets(true)       // derruba e bloqueia o Socket.IO; restoreSockets() libera
kurioMock.expireSessions()        // expira as sessões no servidor
kurioMock.settleOrder('order-xx') // liquida um pedido pendente agora
kurioMock.reset()                 // restaura o seed
```

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Skeletons e nova tentativa | `/?scenario=slow` mostra skeletons; `/?scenario=flaky` mostra o erro e "Tentar novamente" recupera |
| Respostas fora de ordem | `/?scenario=out-of-order`; troque de aba rápido: o resultado final corresponde à última aba |
| Favorito com rollback | Entre como Bruno, ative `favorites-error` no painel e favorite um NFT: o coração volta e aparece um toast de erro |
| Cupom inválido ou expirado | No carrinho, aplique `XPTO` ou `VERAO20` |
| Preço muda com o carrinho aberto | Alice: adicione Emerald Ape #042, abra `/cart` e rode `kurioMock.setPrice(...)`: aviso, resumo atualizado e checkout bloqueado até "Aceitar novos preços" |
| Mudança durante a revisão | Abra a revisão do pagamento e rode `kurioMock.setPrice(...)`: diff e "Aceitar novos valores" |
| Cotação rejeitada no envio | `?scenario=price-change-on-checkout` e confirme a compra: 409, diff e nova confirmação |
| Pagamento recusado | `?scenario=payment-declined`: pedido recusado, carrinho preservado |
| Clique repetido e timeout | `?scenario=order-timeout`: após 10s, "Tentar novamente" recupera **o mesmo** pedido (`kurioMock` e `GET /api/orders` mostram 1 pedido) |
| Pedido pendente e reconexão | `?scenario=payment-slow`; confirme, recarregue (continua pendente, sem nova compra), rode `kurioMock.dropSockets(true)`, depois `settleOrder(id)` e `restoreSockets()`: confirma via reconciliação REST |
| Eventos duplicados ou antigos | `kurioMock.setPrice` duas vezes e depois `replay` do 1º evento: o preço não regride |
| Sessão expirada | Logado, rode `kurioMock.expireSessions()` e navegue para Carteiras ou confirme no checkout: login com retorno e rascunho preservado |
| Carteira recusada | `?scenario=wallet-rejected` e "Conectar" na revisão |

## Testes E2E (Playwright)

```bash
npx playwright install chromium   # uma vez
npm run test:e2e                  # relatório HTML: npx playwright show-report
```

- Rodam contra o **build de produção** (`vite preview`) com MSW. Cada teste usa um contexto isolado (storage vazio e seed limpo).
- **Projetos:**
  - `chromium-desktop` (1440×900): todos os testes.
  - `chromium-mobile` (390×844, Pixel 7): fluxos principais marcados com `@mobile`.
  - `chromium-tablet` (768×1024): os mesmos fluxos `@mobile`, sem regressão visual.
- **Contra o deploy:** `BASE_URL=https://<seu-app>.vercel.app npm run test:e2e` usa a URL publicada em vez de subir o `vite preview` local.
- O REST passa pelos handlers MSW, e o tempo real passa pelo `socket.io-client` (eventos disparados no servidor simulado pela API de controle).
- Relógio controlado com `page.clock` (timeout do pedido); latência e falhas vêm dos cenários; traces só em falha (`test-results/`).

| Spec | Cobertura (itens do §9 do enunciado) |
| --- | --- |
| `catalog.spec.ts` | 1: busca, filtros combinados, ordenação, paginação, refresh e histórico; vazio; fora de ordem |
| `nft-detail.spec.ts` | 2: acesso direto, NFT e rota inexistentes, edição esgotada, limite de quantidade |
| `auth.spec.ts` | 3: cadastro (validação e conflito), login com retorno, refresh, expiração, logout e troca de usuário |
| `favorites.spec.ts` | 4: persistência, falha da mutation com rollback e recuperação |
| `cart.spec.ts` | 5: quantidades, remoção, resumo, cupons, refresh, merge no login, estoque |
| `purchase.spec.ts` | 6: compra completa até o recibo (snapshot); validação; sessão expirada no checkout |
| `payment-failures.spec.ts` | 7: recusa, clique repetido, timeout com recuperação idempotente, carteira recusada |
| `account.spec.ts` | 8: perfil, avatar, senha e carteiras com erros de validação |
| `realtime.spec.ts` | 9 e 10: preço muda no carrinho e no checkout, 409 no envio, duplicados e antigos, reconexão, pedido pendente |
| `a11y.spec.ts` | 11: axe (WCAG 2.1 AA, sem violações graves), teclado, foco de diálogos, validação |
| `loading.spec.ts` | 12: skeletons, erro e nova tentativa, 500, offline |
| `server-rules.spec.ts` | Esgotamento no envio, idempotência (mesma chave = mesmo pedido; conteúdo diferente = 409), pedido de outro usuário (403), liberação do socket no logout, latência variável |
| `visual.spec.ts` | Regressão visual de início, detalhe, carrinho e pagamento (desktop e mobile), baselines em `tests/e2e/visual.spec.ts-snapshots/` |

**Último resultado local:** 94 testes passando (58 desktop + 20 mobile + 16 tablet), em Windows 11 e Chromium headless shell 156. As baselines visuais são de `win32`; em outra plataforma, gere-as com `npm run test:e2e:update`.

## Performance e Lighthouse

`npm run lighthouse` audita início (`/`) e detalhe (`/nfts/emerald-ape-042`) nos perfis mobile (padrão do Lighthouse: 4G lento simulado e CPU 4×) e desktop. São 3 execuções cada, sobre o build de produção com mocks (o cenário padrão), sem simplificações exclusivas para a auditoria.

- **Configuração versionada:** `lighthouse/config.mjs`.
- **Relatórios HTML/JSON por execução:** `lighthouse/reports/`.
- **Medianas, versões e ambiente:** `lighthouse/reports/summary.md` e `summary.json`.

Medianas da última execução (2026-10-29): Lighthouse 13.6.0, HeadlessChrome 156, Node 22.22, Windows 11, Ryzen 7 2700, `vite preview` local.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | **89** | 100 | 100 | 100 | 785 ms | 0.002 | 442 ms |
| Início | desktop | 98 | 100 | 100 | 100 | 1105 ms | 0.001 | 35 ms |
| Detalhe | mobile | **77** | 100 | 100 | 100 | 4699 ms | 0 | 291 ms |
| Detalhe | desktop | 98 | 100 | 100 | 100 | 1080 ms | 0 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Ficam **abaixo da meta** a performance mobile do detalhe (77) e a do início (89; as execuções variaram entre 86 e 90 ao longo do trabalho).

**Causas identificadas** (diagnósticos `bootup-time`, `unused-javascript` e `lcp-breakdown` nos JSONs):

1. **Camada de mocks no caminho crítico.** O MSW, mais o backend simulado (cerca de 170 KB gzip, com interceptors, cookies, seed e regras), precisa registrar o Service Worker e iniciar *antes* do primeiro render, para que as requisições iniciais já sejam interceptadas.
   - No perfil mobile (CPU 4×), esse chunk consome cerca de 0.7s de CPU e gera a maior parte do TBT. Também é o maior item de "unused JavaScript", porque a maior parte dos handlers não roda no carregamento.
   - Em produção com API real, esse custo não existiria. A auditoria o inclui porque mede a entrega real.
2. **LCP do detalhe depende de dados.** A imagem do NFT só é conhecida após `GET /nfts/:id`, então a cadeia simulada (HTML → JS → MSW → SW → chunk da rota → API → imagem) fica serial no modelo de 4G lento.
   - O breakdown observado sem throttling é pequeno (TTFB de 4ms, atraso de carga de 0.47s, carga de 57ms). O valor de 4.7s é a estimativa simulada do Lantern.
   - No início, o LCP é o parágrafo de texto do hero, que não depende de dados; o que pesa ali é o TBT.

**Otimizações aplicadas** (com efeito medido):
- App baixado em paralelo ao MSW; Socket.IO carregado sob demanda.
- `main` com altura mínima: CLS do detalhe desktop passou de 0.136 para 0.
- Carrossel com área de toque adequada e nome acessível coerente: accessibility passou de 97 para 100.
- Code splitting por rota, imagens WebP responsivas (`srcset`/`sizes`), `fetchpriority=high` na imagem LCP e fonte self-hosted só com o subset latino.

**Próximos passos possíveis:**
- Pré-renderizar o HTML das rotas públicas.
- Embutir o seed do detalhe no HTML para a imagem ser descoberta sem esperar a API.
- Mover o backend simulado para um Web Worker, tirando a CPU dele da thread principal.

## Deploy

O `vercel.json` está configurado (build `npm run build`, saída `dist/`, rewrite de SPA para que acesso direto e refresh funcionem, e `mockServiceWorker.js` sem cache). O build de demonstração inclui os mocks e o tempo real.

**URL pública:** https://frontend-challenge-ivory-iota.vercel.app. Para testar contra ela: `BASE_URL=https://frontend-challenge-ivory-iota.vercel.app npm run test:e2e`.

## Estrutura

```
src/app        bootstrap, QueryClient, router, layout, painel de mocks
src/routes     rotas (TanStack Router, file-based)
src/features   telas e hooks de dados por domínio
src/shared     contratos zod, Axios, sessão, Socket.IO, money, UI
src/mocks      backend simulado (MSW): db, domínio, handlers, tempo real, cenários
tests/e2e      Playwright
lighthouse     auditoria
scripts        exportação de assets do Figma
```
