# Decisões técnicas

Registro conciso das decisões que moldaram a solução. Cada item traz contexto, escolha, motivo e alternativas descartadas. Detalhes de contratos e fluxos estão em [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Build e organização: Vite + organização por feature

- **Contexto:** o projeto começou vazio; a ferramenta de build ficava a critério do candidato.
- **Escolha:** Vite + React 19 + TypeScript `strict` (com `noUncheckedIndexedAccess`). O código fica em `src/features/<domínio>` (hooks de dados e componentes), `src/shared` (contratos, cliente HTTP, sessão, tempo real e UI) e `src/mocks` (backend simulado).
- **Por quê:** o build é rápido e tem integração oficial com o TanStack Router (geração de rotas e code splitting automático por rota). A organização por feature deixa claro o dono de cada regra.
- **Descartado:** Next.js. SSR não agrega valor com uma API simulada no navegador e complicaria o MSW e o deploy estático.

## 2. Contratos com zod compartilhados entre cliente e mocks

- **Contexto:** o README exige "contratos tipados entre transporte, estado e interface".
- **Escolha:** um único módulo, `src/shared/contracts`, com schemas zod. O cliente valida toda resposta em `request()`, e os handlers do MSW validam os payloads com os mesmos schemas.
- **Por quê:** se um mock divergir do contrato, a tela mostra um erro explícito em vez de renderizar dados quebrados. Os tipos TypeScript saem dos schemas, sem duplicação.
- **Descartado:** tipos escritos à mão, sem validação em runtime.

## 3. Valores em ETH: strings decimais calculadas com `bigint` em wei

- **Contexto:** "Valores em ETH devem trafegar como strings decimais e manter precisão".
- **Escolha:** `src/shared/lib/money.ts` converte a string para `bigint` com 18 casas, faz soma, multiplicação e percentual, e converte de volta. A exibição trunca (nunca arredonda um preço para cima). O total que vale é sempre o da cotação do servidor (`POST /quotes`).
- **Por quê:** é exato, não precisa de dependência e o mesmo código roda no cliente e no mock.
- **Descartado:** `number` (erro de ponto flutuante) e bibliotecas como big.js ou decimal.js, desnecessárias para quatro operações.

## 4. Estado remoto no TanStack Query; estado de URL no Router; sessão em uma store externa

- **Escolha:**
  - **Router:** busca, filtros, ordenação e página são *search params* validados com zod (`.catch` descarta valores inválidos).
  - **Query:** todo dado de servidor fica no cache do Query, com chaves privadas em `['me', userId, ...]` e o carrinho em `['cart', owner]`.
  - **Sessão:** uma store mínima com `useSyncExternalStore`, para que o interceptor do Axios, os guards do Router e o socket a leiam de forma síncrona.
- **Por quê:**
  - A URL é a fonte da verdade do catálogo, o que garante refresh, histórico e links compartilháveis.
  - Chaves por usuário permitem limpar tudo de uma vez no logout e impedem vazamento entre usuários.
- **Descartado:** Redux/Zustand para dados remotos (duplicaria o cache do Query) e Context para a sessão (fora do React, o interceptor não alcança).

## 5. Política de cache e retries

- **Escolha:**
  - `staleTime` de 30s, ou de 10s no carrinho. O tempo real mantém os dados frescos.
  - **Queries:** 1 retry automático, só em falhas transitórias (rede, timeout, 5xx).
  - **Mutations:** sem retry automático.
  - **Catálogo:** `placeholderData: keepPreviousData`, para a grade não piscar ao trocar de página ou filtro.
- **Por quê:** repetir uma mutation sem idempotência pode duplicar operações. O pedido tem retry próprio e controlado (item 8).

## 6. Respostas fora de ordem

- **Escolha:** a query key do catálogo inclui os parâmetros normalizados, e o `AbortSignal` do Query chega ao Axios.
- **Por quê:** uma resposta atrasada só pode preencher a chave dela, nunca a atual, e requisições obsoletas são canceladas. O cenário `out-of-order` e um teste E2E cobrem isso.

## 7. Sessão, expiração e troca de usuário

- **Escolha:**
  - Token opaco com expiração, emitido pelo mock. A sessão fica no `localStorage` e é revalidada no boot (`GET /auth/session`).
  - **401 com o token *atual*:** encerra a sessão como expirada. Se a rota é privada, redireciona para `/login?redirect=…&reason=expired`. O rascunho do checkout fica no `sessionStorage` por usuário e é restaurado após o login.
  - **Logout ou troca de usuário:** cancela e remove as queries privadas e do carrinho. O socket da sessão anterior é descartado e um novo é criado com as novas credenciais.
  - **Senhas:** guardadas no mock como SHA-256 com salt aleatório (WebCrypto), nunca em claro.
- **Por quê:** um 401 atrasado de uma sessão antiga não pode derrubar a sessão nova; por isso comparo o token enviado com o atual.
- **Descartado:** cookies httpOnly. Seriam o ideal em produção, mas não há servidor real; registrado como limitação.

## 8. Pedido idempotente e recuperação

- **Escolha:**
  - Cada tentativa de compra gera uma `Idempotency-Key` ligada a um payload exato (hash canônico), persistida no `localStorage` por usuário (`order-attempt.ts`).
  - Cliques repetidos são barrados por um lock síncrono mais o botão desabilitado.
  - Após timeout, "Tentar novamente" reenvia a mesma chave com o mesmo payload, e o servidor devolve o mesmo pedido. Mesma chave com conteúdo diferente gera 409.
  - Depois de um refresh, o checkout encontra a tentativa salva e volta ao pedido pendente.
- **Por quê:** é o único jeito de "impedir pedidos duplicados em cliques repetidos ou reenvios após timeout".
- **Descartado:** desabilitar o botão sem idempotência, que não resolve timeout nem refresh.

## 9. Revalidação da cotação e reconfirmação

- **Escolha:**
  - **Servidor:** ao criar o pedido, recalcula preço, estoque, cupom e taxa, e compara com a cotação confirmada (fingerprint). Se mudou, responde 409 `QUOTE_STALE` com a nova cotação.
  - **Cliente:** mostra o diff ("de X para Y") e exige "Aceitar novos valores" antes de liberar "Confirmar compra".
  - **Tempo real:** um `nft.updated` durante a revisão produz o mesmo efeito.
  - **Carrinho:** cada item guarda o preço aceito (`addedPriceEth`). Uma mudança vira o *issue* `price-changed`, que bloqueia o checkout até o usuário aceitar.
- **Por quê:** "o checkout impede a confirmação com uma cotação desatualizada" e "mudanças devem exigir nova confirmação".

## 10. MSW como backend simulado com estado

- **Escolha:**
  - Um "servidor" completo em `src/mocks`: DB em memória persistido em `localStorage`, seed determinístico (PRNG com semente fixa), regras de negócio em `domain.ts` e handlers finos por recurso.
  - Cenários nomeados e combináveis (`?scenario=slow,payment-declined`).
  - API de controle `/api/__mock/*` para reset, cenário e disparo de mudanças no servidor.
  - Ativado por `VITE_ENABLE_MOCKS`, inclusive no build de demonstração.
- **Por quê:**
  - Componentes, hooks e o Axios não têm nenhum caminho fictício.
  - Testes, demo e desenvolvimento usam exatamente os mesmos mocks.
  - O reset restaura um cenário conhecido.
- **Descartado:** um json-server ou backend Node, que exigiria um serviço extra no deploy estático.

## 11. Socket.IO via `@mswjs/socket.io-binding`

- **Contexto:** o tempo real precisa passar pelo `socket.io-client` real.
- **Escolha:**
  - O `ws.link` do MSW intercepta o WebSocket, e o binding traduz o protocolo Socket.IO.
  - Eventos `nft.updated` e `order.updated` com `id` estável, `resource` e `version`.
  - **Cliente:** descarta ids já vistos, versões menores ou iguais à última aplicada e `order.updated` de outro usuário. Ao reconectar, invalida os recursos ativos (REST como fonte da verdade).
  - Testes e o helper de console mudam o *servidor*, que emite pelo socket.
- **Achados durante a integração:**
  - O MSW 2.15 remove o prefixo `/socket.io/` antes de casar a URL, então o link aponta para a origem.
  - O `engine.io-client` captura o `WebSocket` global quando o módulo é avaliado, por isso o `socket.io-client` é importado depois que o MSW aplica o patch (import lazy no provider).
  - O binding finge o handshake (`pingInterval` de 25s), então o mock envia pings.
- **Descartado:** um EventEmitter ou chamadas diretas ao cache, que seriam critério eliminatório.

## 12. Atualização otimista em favoritos

- **Escolha:** o coração muda na hora (`onMutate`). Em erro, o estado é revertido com um toast, e em `onSettled` a query é revalidada.
- **Por quê:** é uma interação de baixo risco e alta frequência, e o rollback fica fácil de demonstrar com o cenário `favorites-error`.

## 13. Carrinho de visitante via API com merge no login

- **Escolha:**
  - O visitante usa um carrinho do servidor identificado por `X-Cart-Id`; o servidor gera o id.
  - No login, `POST /cart/merge` incorpora os itens respeitando estoque e limite. O merge roda *antes* de ativar a sessão, para a query do carrinho do usuário nunca observar o estado anterior.
- **Por quê:** existe um único caminho de código (sempre a API) e o resumo do carrinho vem sempre da cotação do servidor.
- **Descartado:** carrinho do visitante só em `localStorage`, que criaria duas fontes de verdade.

## 14. UI: shadcn/ui adaptado aos tokens do Figma

- **Escolha:**
  - Tokens (cores, Roboto Mono, raios) extraídos pela API do Figma para variáveis CSS do Tailwind v4.
  - Componentes shadcn (Dialog, Select, Sheet, Slider, Dropdown e Sonner) reestilizados.
  - Artes exportadas do Figma em WebP com variantes 320, 640 e 960 (`scripts/sync-figma-assets.mjs`).
  - Fonte self-hosted com `@fontsource`.
- **Por quê:** é fiel ao layout e tem acessibilidade do Radix (foco, teclado, ARIA).

## 15. Testes E2E contra o build de produção

- **Escolha:**
  - **Execução:** Playwright sobre `vite preview` do build com mocks.
  - **Projetos:** `chromium-desktop` (1440px) e `chromium-mobile` (390px, testes `@mobile`).
  - **Isolamento:** um contexto novo por teste, o que significa storage vazio e seed limpo.
  - **Controle de tempo e eventos:** `page.clock` para o timeout e a API de controle do mock para disparar eventos.
  - **Apoio:** axe para acessibilidade, regressão visual com baselines versionadas, traces só em falha.
- **Por quê:** testa exatamente o bundle publicado, e o REST passa pelos handlers MSW enquanto o tempo real passa pelo `socket.io-client`.

## 16. Desempenho

- **Escolha:**
  - Code splitting automático por rota.
  - O app é baixado em paralelo com a camada de mocks.
  - Imagens com `srcset`/`sizes`; LCP com `fetchpriority=high`.
  - `main` com altura mínima, contra layout shift.
  - Socket.IO carregado sob demanda.
- **Compromisso:**
  - A camada de mocks (MSW mais o backend simulado, cerca de 170 KB gzip) roda na thread principal antes do primeiro render. No perfil mobile simulado do Lighthouse, isso custa cerca de 0.7s de CPU.
  - A auditoria mede a entrega real, sem desligar mocks. Os números e as causas estão no README.
