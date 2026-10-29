# Arquitetura

## Visão geral

```
src/
  main.tsx              bootstrap: inicia o MSW (se habilitado) e renderiza o app
  app/                  QueryClient, router, layout (header, footer, tab bar mobile), painel de mocks
  routes/               rotas file-based do TanStack Router (+ routeTree.gen.ts gerado)
  features/
    auth/ catalog/ nft/ favorites/ cart/ checkout/ orders/ account/
                        hooks de dados (TanStack Query) + componentes de tela
  shared/
    contracts/          schemas zod = contratos de transporte (cliente E mocks)
    api/                Axios, ApiError, endpoints tipados, query keys
    session/            store de sessão (useSyncExternalStore)
    realtime/           cliente Socket.IO + provider
    lib/                money (bigint wei), storage seguro, utils
    components/ ui/     componentes compartilhados e shadcn/ui adaptados
  mocks/                backend simulado: db, domain, handlers REST, realtime, cenários, controle
tests/e2e/              Playwright (fixtures, fluxos, specs, baselines visuais)
lighthouse/             config + runner + relatórios
```

Fluxo de dados: **componente → hook (Query) → `api.*` (Axios) → MSW handler → domain → db**. O caminho de volta é a resposta validada pelo schema zod e gravada no cache. Os eventos fazem **domain → emitNftUpdated/emitOrderUpdated → socket → socket.io-client → RealtimeClient → cache do Query**.

## Contratos REST

Base: `VITE_API_URL` (padrão `/api`). Erros sempre no formato `{ error: { code, message, fieldErrors?, details? } }`.

| Método e rota | Auth | Corpo / query | Resposta | Erros |
| --- | --- | --- | --- | --- |
| `POST /auth/register` | — | `{ username, email, password }` | `201 Session` | 422 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN` / `USERNAME_TAKEN` |
| `POST /auth/login` | — | `{ email, password }` | `Session` | 422, 401 `INVALID_CREDENTIALS` |
| `GET /auth/session` | Bearer | — | `Session` | 401 `UNAUTHENTICATED` / `SESSION_EXPIRED` |
| `POST /auth/logout` | Bearer | — | 204 | — |
| `GET /nfts` | opcional | `q, tab, collection[], network[], minPrice, maxPrice, sort, page, pageSize` | `CatalogPage` (itens, paginação, facetas) | 400, 5xx (cenários) |
| `GET /nfts/featured` | — | — | `{ items: NftSummary[] }` | — |
| `GET /nfts/:id` | — | — | `NftDetail` (edições, galeria, atributos) | 404 `NOT_FOUND`, 5xx |
| `GET /nfts/:id/related` | — | — | `{ items }` | 404 |
| `GET /me/favorites` | Bearer | — | `{ nftIds }` | 401 |
| `PUT` / `DELETE /me/favorites/:nftId` | Bearer | — | `{ nftIds }` | 401, 404, 500 (cenário) |
| `GET /cart` | Bearer ou `X-Cart-Id` | — | `Cart` (+ header `X-Cart-Id` para visitante) | 401 |
| `POST /cart/items` | idem | `{ nftId, editionId, quantity }` | `201 Cart` | 404, 409 `OUT_OF_STOCK` / `QUANTITY_LIMIT` |
| `PATCH /cart/items/:id` | idem | `{ quantity }` | `Cart` | 404, 409 (só ao aumentar) |
| `DELETE /cart/items/:id` | idem | — | `Cart` | — |
| `PUT` / `DELETE /cart/coupon` | idem | `{ code }` | `Cart` | 422 `COUPON_INVALID` / `COUPON_EXPIRED` |
| `POST /cart/acknowledge-prices` | idem | — | `Cart` | — |
| `POST /cart/merge` | Bearer | `{ guestCartId }` | `Cart` | 401 |
| `POST /quotes` | Bearer ou `X-Cart-Id` | `{ network }` | `201 Quote` (linhas, cupom, subtotal, desconto, taxa, total, issues, validade) | 422 |
| `POST /wallets/:id/connect` | Bearer | `{ provider, network }` | `WalletConnection` | 403, 404, 409 `WALLET_REJECTED` |
| `POST /wallets/:id/disconnect` | Bearer | — | `WalletConnection` | — |
| `POST /orders` | Bearer + `Idempotency-Key` | `{ quoteId, walletId, provider, network, buyer }` | `201 Order` (pending); `200` mesmo pedido (mesma chave) | 400 sem chave, 409 `IDEMPOTENCY_CONFLICT`, 409 `QUOTE_STALE` / `OUT_OF_STOCK` (+ `details.quote`), 403, 409 `WALLET_REJECTED` |
| `GET /orders/:id` | Bearer | — | `Order` | 403 `FORBIDDEN` (outro usuário), 404 |
| `GET /orders?status=` | Bearer | — | `{ items: Order[] }` | — |
| `GET` / `PATCH /me/profile` | Bearer | `ProfileInput` | `User` | 422, 409 |
| `PUT /me/avatar` | Bearer | `{ dataUrl \| null }` (PNG/JPEG/WebP, ≤ 1 MB) | `User` | 422 |
| `POST /me/password` | Bearer | `{ currentPassword, newPassword }` | 204 (revoga as outras sessões) | 422 |
| `GET` / `POST /me/wallets`, `PUT /me/wallets/:id` | Bearer | `WalletInput` (endereço validado por rede) | `Wallet` | 422, 409 (espaço ocupado, endereço duplicado), 403 |

Os schemas completos estão em `src/shared/contracts/index.ts`.

### Pedido: estados e snapshot

`pending` → `confirmed` | `declined` (os dois últimos são terminais).

- Na criação, o estoque é reservado e o pedido guarda um **snapshot** das linhas, do cupom e dos valores da cotação. O recibo só lê esse snapshot.
- A liquidação ocorre após um atraso simulado (`settleAt`, persistido; atrasos vencidos são liquidados no próximo acesso ou carga da página).
- **Confirmado:** gera `txHash` e `explorerUrl` simulados e remove do carrinho **apenas as quantidades compradas**.
- **Recusado:** devolve o estoque e mantém o carrinho intacto.

## Eventos Socket.IO

Transporte: o `socket.io-client` real (`transports: ['websocket']`, `auth: { token }`) conecta em `VITE_SOCKET_URL`. No ambiente de mocks, o `ws.link` do MSW intercepta e o `@mswjs/socket.io-binding` codifica e decodifica o protocolo.

Envelope comum:

```ts
{ id: string; occurredAt: string; version: number; type; resource: { type; id }; payload }
```

| Evento | Recurso | Payload | Destinatários | Efeito no cliente |
| --- | --- | --- | --- | --- |
| `nft.updated` | `nft:<id>` | `{ nftId, priceEth, compareAtPriceEth, available, editions[{id, priceEth, available}] }` | todos | atualiza detalhe, catálogo, destaques e relacionados via `setQueryData` (somente se `version` for maior); se o NFT está no carrinho, invalida carrinho e cotação e mostra um aviso |
| `order.updated` | `order:<id>` | `{ order }` | apenas os sockets do dono | atualiza `['me', userId, 'order', id]` se a versão for maior; se confirmado, invalida o carrinho |

### Reconciliação REST × Socket.IO

1. **Deduplicação:** ids já vistos são ignorados (conjunto limitado a 500).
2. **Ordenação:** `version` menor ou igual à última aplicada por recurso é ignorada, e o cache também compara com a `version` do dado REST.
3. **Isolamento:** `order.updated` com `userId` diferente do usuário atual é descartado. O servidor também só envia ao dono.
4. **Reconexão:** no `connect` seguinte a uma queda, as queries ativas de catálogo, NFT, carrinho, cotação e pedidos são invalidadas. O REST é a fonte da verdade para o que se perdeu.
5. **Ciclo de vida:** um socket por sessão. No logout ou troca de usuário, `dispose()` remove os listeners e desconecta. O pedido pendente também tem polling REST a cada 5s como fallback.

### Limitações do transporte simulado

- O binding suporta só o namespace padrão, sem rooms nem acks. O roteamento por usuário é feito à mão no mock.
- O binding finge o handshake (`pingInterval` de 25s), então o mock envia pings a cada 20s.
- O MSW 2.15 remove o prefixo `/socket.io/` antes de casar a URL, por isso o link aponta para a origem (`wss://realtime.kurio.mock/*`).
- O `engine.io-client` captura o `WebSocket` global quando o módulo é avaliado. Por isso o `socket.io-client` só é importado depois que o MSW aplica o patch.
- Em "servidor fora do ar" (`kurioMock.dropSockets(true)`), a conexão abre e cai sem handshake. O cliente tem `timeout` de 5s e backoff de 0.5 a 3s.
- O "servidor" vive na aba: duas abas não compartilham sockets, e o estado só é compartilhado via `localStorage` ao recarregar.

## Política de sessão

- Token opaco aleatório com TTL de 2h (30s no cenário `session-expired`). Fica salvo no `localStorage` (`kurio:session`).
- **Boot:** `GET /auth/session` revalida. Um 401 encerra a sessão; uma falha de rede mantém a sessão local.
- **401 durante o uso:** só encerra a sessão se o token enviado for o atual. Em rota privada, o usuário vai para o login com `redirect` e `reason=expired`.
- **Contexto preservado na expiração:** rascunho do checkout (`sessionStorage`, por usuário), tentativa de pedido (`localStorage`, por usuário) e carrinho no servidor.
- **Logout:** `POST /auth/logout` (o logout local acontece mesmo offline). Cancela e remove as queries `['me']` e `['cart']`, apaga o rascunho e a tentativa, e recria o socket sem credenciais.
- **Outra aba:** o evento `storage` sincroniza login e logout.

## Estado do carrinho

- O carrinho sempre vive no servidor. O visitante é identificado por `X-Cart-Id` (gerado pelo servidor e guardado no `localStorage`); o usuário, pelo token.
- **Login:** `POST /cart/merge` com o token novo, *antes* de ativar a sessão. Respeita estoque e limite por edição.
- **Cache:** `['cart', userId | 'guest']`. As mutations substituem o cache pela resposta do servidor (a autoridade em estoque). Em erro, o cache é revalidado.
- **Resumo:** sempre `POST /quotes`. A chave inclui a `version` do carrinho; mudanças de preço via socket invalidam a cotação explicitamente.
- **Issues da cotação:**
  - `sold-out` e `insufficient-stock` bloqueiam o checkout até o usuário ajustar a quantidade.
  - `price-changed` bloqueia até "Aceitar novos preços" (`POST /cart/acknowledge-prices`).

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
| --- | --- | --- | --- |
| Catálogo | `['catalog', params]` | 30s | `keepPreviousData`, AbortSignal, patch via socket |
| Destaques / relacionados | `['featured']`, `['related', id]` | 60s | patch via socket |
| Detalhe | `['nft', id]` | 30s | prefetch no loader da rota (sem bloquear a navegação) |
| Carrinho | `['cart', owner]` | 10s | resposta da mutation vira o cache |
| Cotação | `['me', owner, 'quote', network, cartVersion]` | 60s | invalidada por eventos e mutations |
| Favoritos | `['me', userId, 'favorites']` | 30s | otimista com rollback |
| Pedido | `['me', userId, 'order', id]` | 30s | evento + polling de 5s enquanto pendente |
| Perfil / carteiras | `['me', userId, 'profile' \| 'wallets']` | 30s | `setQueryData` após salvar |

Retries: 1 automático, só para falhas transitórias. Mutations não são repetidas automaticamente.

## Decisões de UX

- O catálogo reinicia a página ao mudar filtro, aba ou busca. Chips de filtros ativos têm remoção individual e "Limpar filtros".
- No mobile, os filtros abrem em um Sheet lateral, e o detalhe tem uma barra fixa de compra (quantidade, preço, comprar e adicionar).
- "COMPRAR" adiciona ao carrinho e leva ao carrinho; o ícone de carrinho (mobile e cards) só adiciona.
- **Pagamento:** o formulário leva a "Revisar e confirmar compra", que abre um diálogo de revisão. Nele o usuário conecta a carteira (aprovação simulada), pode desconectar e confirma. Mudanças de valores mostram o diff e exigem aceite.
- A confirmação usa o layout do frame "Confirmação de Pedido", como página (rota `/orders/:id`) e não como modal, para suportar acesso direto e refresh.
- Itens fora do escopo (Criadores, Aprenda, editorial, newsletter, suporte, atividade, ofertas, downloads, login social, "Esqueceu a senha?", links do rodapé) ficam visíveis e mostram um aviso "não está disponível nesta demonstração", sem simular sucesso.

## Desvios do Figma e ajustes

- **Login e cadastro:** no desktop, o Figma mostra um modal sobre a home. Implementei como página dedicada com o mesmo cartão (borda inferior cobre e abas Entrar | Criar conta), para ter URL própria, `redirect` e acesso direto. No mobile, segue o frame.
- **Campos obrigatórios:** "Código de indicação" e "Nome ENS" aparecem com `*` em pagamento, perfil e carteiras, mas foram tratados como opcionais (com dica "Opcional"). Um código de indicação obrigatório bloquearia compras legítimas.
- **Pagamento:** "Endereço da carteira" e "ENS ou carteira secundária" são somente leitura e vêm da carteira cadastrada selecionada (o README pede o uso das carteiras cadastradas). "Usar outra carteira?" alterna para a carteira secundária. A lista de provedores (MetaMask, WalletConnect, Coinbase) segue o layout.
- **Edições:** os chips "1/1, 1/10, 1/50, ABERTA" têm preços e estoques próprios. O preço do card é o da edição mais barata com estoque (1/50 no seed, que bate com o Figma, por exemplo Emerald Ape a 1.19 ETH).
- **Avaliações:** a aba existe com nota e contagem, mas comentários não fazem parte do escopo.
- **Ícones de marca:** o lucide v1 removeu os ícones de marca, então uso SVGs próprios equivalentes.
- **Acessibilidade:**
  - Asterisco de obrigatório via CSS (fora do nome acessível).
  - Links inline sublinhados.
  - Dots de carrossel com área de toque de 24px.
  - `scroll-padding` para o foco não ficar sob a tab bar mobile.
  - Link "Pular para o conteúdo".
- **Assets:** as 4 artes de NFT são exportadas do arquivo Figma (WebP 320, 640 e 960) e reaproveitadas pelos 60 NFTs do seed, como no próprio layout. As duas outras imagens do arquivo (capturas de outro projeto) não foram usadas.

## Limitações conhecidas

- Não há backend real: sessão em `localStorage` (em produção, cookie httpOnly) e hash de senha feito no navegador.
- O backend simulado roda na aba. Mutations em andamento são perdidas se a página recarregar antes de o handler responder (cerca de 120ms). Os testes esperam a resposta antes de recarregar.
- As baselines visuais foram geradas no Windows (sufixo `-win32`). Em Linux ou CI, rode `npm run test:e2e:update` para gerar as da plataforma.
- **Lighthouse:** a página de detalhe fica abaixo da meta de performance no perfil mobile simulado (ver README). O custo vem da camada de mocks executada antes do primeiro render.
- Deploy: o `vercel.json` está pronto, mas a publicação depende de autorização (não foi feita).
