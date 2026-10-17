---
title: 'Incremento 1.1: Worker + D1 publicados atrás do Cloudflare Access'
type: 'feature'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
baseline_commit: '5e68879d91fc571a8e6e0b3baf8358d5b25f646f'
review_loop_iteration: 0
context: ['{project-root}/SPEC.md', '{project-root}/CONTEXT.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório ainda não tem código. Os próximos itens do Incremento 1 precisam de um Worker publicado, de um D1 com o esquema base e de autenticação. Nenhuma rota pode ficar exposta sem o Access.

**Approach:** Criar um Worker em Hono/TypeScript com o binding do D1 e uma migração inicial que cria `favorites` (mínima) e `events`. No evento de Desfecho, `open_id` aponta para o evento Abrir correspondente. Um middleware global valida o `Cf-Access-Jwt-Assertion` contra o JWKS da equipe do Access e falha fechado. O Access fica na frente de toda URL pública.

## Boundaries & Constraints

**Always:**
- Código, identificadores, SQL e commits em inglês. Texto de interface em pt-BR. Mapa de termos: Favorito→favorite, Evento→event, Triagem→triage, Inversão→flip, Resgate→rescue, Pular→skip, Abrir→open, Desfecho→outcome, Aprendi/Consumi/Lixo→learned/consumed/junk, Lição→lesson.
- O middleware de JWT roda em todas as rotas. Ele aceita só RS256 e exige `iss` igual a `ACCESS_TEAM_DOMAIN` e `aud` contendo `ACCESS_AUD`. Qualquer falha resulta em 403. Se uma das variáveis estiver vazia, a resposta é 500 e nenhum conteúdo é servido.
- As regras de integridade dos eventos ficam no banco (CHECK, UNIQUE e trigger), não no código da aplicação.
- `preview_urls: false`. O `workers.dev` só fica ativo atrás do Access.
- **Decisão (2026-10-17):** a URL pública é `favorites-to-fire.<conta>.workers.dev`, com o Access ativado pelo dono no painel do Worker (Settings → Domains & Routes). Não há domínio próprio.

**Never:**
- Bypass de autenticação para desenvolvimento local, nem via variável.
- Tabelas para Fontes, Escopos ou Propostas. Elas entram nos itens que as usam.
- Colunas de payload de outros tipos de evento (por exemplo, o veredito da Triagem). Elas entram depois, via `ALTER TABLE ADD COLUMN`.
- Interface além de uma rota `/` de verificação.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| JWT válido | header assinado por uma chave do JWKS, `iss` e `aud` corretos, `exp` no futuro | 200, `Favorites to Fire: N favoritos` (N = count do D1) | N/A |
| Sem header | sem `Cf-Access-Jwt-Assertion` | 403 | não consulta o D1 |
| JWT inválido | assinatura errada, `kid` desconhecido, `aud` ou `iss` errados, ou expirado | 403 | não consulta o D1 |
| Config ausente | `ACCESS_TEAM_DOMAIN` ou `ACCESS_AUD` vazios | 500 | falha fechado |
| Desfecho válido | `type='outcome'`, `open_id` de um `open` do mesmo favorite | insert ok | N/A |
| Desfecho órfão | outcome sem `open_id`, ou com `open_id` de outro favorite, ou de um evento que não é `open` | insert rejeitado | erro do SQLite |
| Desfecho duplicado | segundo outcome com o mesmo `open_id` | insert rejeitado | UNIQUE |
| Aprendi sem Lição | `outcome='learned'` com `lesson` nula ou em branco | insert rejeitado | CHECK |
| Campos de desfecho fora do Desfecho | `type` diferente de outcome com `open_id`, `outcome` ou `lesson` | insert rejeitado | CHECK |

</frozen-after-approval>

## Code Map

- `SPEC.md` §6, §7, §8 -- fonte das regras de eventos, Access e stack. Não alterar.
- `CONTEXT.md` -- glossário (os termos do mapa acima). Não alterar.
- `.gitignore` -- já ignora `node_modules/`, `.wrangler/`, `.dev.vars` e `.env`.
- `hono@4.13.x`, `hono/jwt` → `verifyWithJwks(token, { jwks_uri, allowedAlgorithms, verification: { iss, aud } })`. Ele busca o JWKS, escolhe a chave pelo `kid`, e o `aud` aceita array no payload. Se `iss` ou `aud` vierem vazios, ele **pula** a checagem, daí a guarda de config. O middleware `hono/jwk` não serve aqui, porque exige o formato `Bearer <token>`.
- Access: certs em `${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, com `iss` = `https://<equipe>.cloudflareaccess.com`.
- Toolchain local: Node 22.14 (`--experimental-strip-types` e `node:sqlite` funcionam, com FKs ligadas por padrão) e npm 11. O wrangler não está instalado globalmente.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- `type: module`. Dependência: `hono`. DevDeps: `wrangler` e `typescript`. Scripts: `dev`, `deploy`, `typecheck` (`wrangler types && tsc`) e `test` (`node --no-warnings --experimental-strip-types --test test/*.test.ts`).
- [x] `tsconfig.json` -- strict, ESNext/Bundler, `allowImportingTsExtensions`, `noEmit`, `types: ["./worker-configuration.d.ts"]`, include `src`.
- [x] `wrangler.jsonc` -- `main: src/index.ts`, `workers_dev: true`, `preview_urls: false`, `vars` `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` e `d1_databases` (binding `DB`). O `database_id` vem do `d1 create`.
- [x] `migrations/0001_init.sql` -- `favorites(id, url UNIQUE NOT NULL, title, created_at)` e `events(id, favorite_id FK, type CHECK in 6 tipos, open_id REFERENCES events UNIQUE, outcome, lesson, created_at)`, com CHECKs e o trigger `BEFORE INSERT` que garante que o `open_id` é um `open` do mesmo favorite.
- [x] `src/index.ts` -- app Hono que exporta `default`, com o middleware de Access e `GET /` contando os `favorites`.
- [x] `test/worker.test.ts` -- cobre a matriz: gera um par RSA, assina o JWT com `hono/jwt` `sign`, faz stub do `fetch` para servir o JWKS e chama `app.request(url, init, env)` com um DB falso. O esquema é testado aplicando `0001_init.sql` num `node:sqlite` em memória.
- [ ] Publicação (efeitos externos; adiada pelo dono, ver Implementation Notes) -- `npm i` → o dono roda `! npx wrangler login` → `wrangler d1 create` → `d1 migrations apply DB --remote` → `wrangler deploy` (com as variáveis vazias o Worker responde 500) → o dono ativa o Access e informa o AUD e o team domain → preencher as `vars` → redeploy.

**Acceptance Criteria:**
- Given o Worker publicado com o Access ativo, when alguém sem sessão abre a URL pública, then é redirecionado para o login do Access e nunca vê conteúdo.
- Given o dono autenticado, when abre `/`, then vê `Favorites to Fire: 0 favoritos`.
- Given a URL de preview ou de versão, when acessada, then não existe (`preview_urls: false`).
- Given o D1 remoto, when listo as migrações, then `0001_init.sql` aparece aplicada.

## Implementation Notes

- **Decisão do dono (2026-10-17):** nesta execução só entram efeitos locais (`npm i`, testes, typecheck, `d1 migrations apply DB --local`). Nada remoto: sem `wrangler login`, `d1 create`, `--remote` nem `deploy`. Até o `d1 create`, o `database_id` no `wrangler.jsonc` é um placeholder explícito. A task de Publicação fica para o dono disparar depois.
- Um 4º CHECK na migração: `lesson IS NULL OR coalesce(outcome, '') = 'learned'`. Sem ele, um `skip` com `lesson = ''` passava (o 3º CHECK só olha o texto aparado). Ele também barra Lição em Consumi/Lixo, o que bate com o glossário (Consumi = "sem nada marcante").

## Spec Change Log

## Review Triage Log

Iteração 0. E = Edge Case Hunter, B = Blind Hunter, V = Verification Gap. Grupos: G1 `exp` ausente · G2 403 mudo · G3 brancos na Lição · G4 um Desfecho por Favorito · G5 teste HS256 · G6 cobertura do middleware · G7 constraints de coluna sem teste · G8 `engines` · G9 `.d.ts` gerado.

| # | Achado | Veredito | Evidência | Rota |
|---|---|---|---|---|
| E1 | Barra final ou falta de `https://` em `ACCESS_TEAM_DOMAIN` dá 403 em tudo | low | Real, mas só aparece no setup. O comentário no `wrangler.jsonc` documenta o formato e o G2 passa a logar `JwtTokenIssuer`. A correção seria uma normalização (guarda). | rejeitado |
| E2 | Token assinado sem `exp` é aceito | medium | O hono só checa `exp` quando ele existe (confirmado por probe). A matriz define JWT válido com "`exp` no futuro", e "qualquer falha → 403". | patch (G1) |
| E3 | Fetch do JWKS sem timeout | low | O endpoint é da própria Cloudflare. A correção acrescenta um parâmetro. | rejeitado |
| E4 | Falha do JWKS vira 403 sem log | low | Real (certs com 503 → 403). Um `console.warn` no catch resolve. | patch (G2) |
| E5 | Vars preenchidas no painel somem no redeploy | false | O plano preenche as `vars` no `wrangler.jsonc`, não no painel. | rejeitado |
| E6 | UPDATE em `events` burla o trigger | low | Real, mas nenhum código faz UPDATE. Um trigger append-only entra depois por migração nova, sem reconstruir a tabela. | rejeitado |
| E7 | `trim()` só tira espaços, então Lição `'\t\n'` passa | low | Confirmado por probe. É correção direta do CHECK, e mudar CHECK depois exige reconstruir a tabela. | patch (G3) |
| E8 | `created_at` aceita qualquer texto | low | Ninguém grava `created_at` explícito: o DEFAULT preenche. A correção seria um CHECK novo (guarda). | rejeitado |
| E9 | `favorites.url` em branco é aceito | low | Não há quem escreva em `favorites`. A Importação canoniza, e reconstruir `favorites` antes dela custa pouco (a tabela está vazia). | rejeitado |
| E10 | O caso HS256 é rejeitado por faltar `kid`, não pelo algoritmo | low | Header decodificado `{"alg":"HS256","typ":"JWT"}`. O nome do teste engana. | patch (G5) |
| E11 | Falta teste de token sem `exp` e de falha do JWKS | low | Nenhum caso cobre esses dois caminhos. | patch (G6; a parte do `exp` fica no G1) |
| E12 | Sem `engines` para Node ≥22.13 (`node:sqlite`) | low | É uma linha de metadado. | patch (G8) |
| E13 | O trigger "garante" o vínculo só no INSERT | low | É o mesmo achado do E6. | rejeitado |
| B1 | UPDATE/DELETE em `events` quebram o invariante | low | É o mesmo achado do E6. | rejeitado |
| B2 | Um Favorito aceita mais de um Desfecho, e o teste trata isso como correto | medium | SPEC §2: o Desfecho é terminal. CONTEXT: o Backlog são os Favoritos "sem Desfecho". Um 2º Desfecho rende XP de novo (o farm do §10). A correção é um índice único parcial. | patch (G4) |
| B3 | Lição "uma linha" aceita `\n` no meio | low | "Uma linha" tem mais de uma leitura, e o input da UI ainda não existe. A correção seria um CHECK novo. | rejeitado |
| B4 | `created_at` aceita qualquer texto | low | É o mesmo achado do E8. | rejeitado |
| B5 | Token sem `exp` dá 200 | medium | É o mesmo achado do E2. | patch (G1) |
| B6 | Toda rejeição é um 403 mudo | low | É o mesmo achado do E4. O `observability` não é necessário, porque o `wrangler tail` já mostra o `console.warn`. | patch (G2) |
| B7 | Barra final em `ACCESS_TEAM_DOMAIN` | low | É o mesmo achado do E1. | rejeitado |
| B8 | Middleware testado só em `GET /`, sem caso de JWKS indisponível nem `fetchCalls` no teste sem header | low | A suíte não chama outra rota nem outro método. | patch (G6) |
| B9 | `test/` não passa pelo typecheck | low | É só para o dev. A correção exige outro tsconfig e `@types/node`. | rejeitado |
| B10a | `package-lock.json` ausente do diff | false | O lockfile existe. Foi deixado fora só do diff de revisão. | rejeitado |
| B10b | `worker-configuration.d.ts` (611 KB) nem commitado nem ignorado | low | O `typecheck` regenera o arquivo. Uma linha no `.gitignore` resolve. | patch (G9) |
| B10c | Sem `engines` | low | É o mesmo achado do E12. | patch (G8) |
| V1 | FK e NOT NULL de `events.favorite_id` sem teste | low | Pré-verificado: mutações M1/M2 sobrevivem. | patch (G7) |
| V2 | "Toda rota" checado só em `/` | low | Pré-verificado: a mutação M9 sobrevive. | patch (G6) |
| V3 | UNIQUE e NOT NULL de `favorites.url` sem teste | low | Pré-verificado: M3/M3b sobrevivem. O revisor sugeriu `defer`, mas foi causado por esta mudança e são duas linhas. | patch (G7) |
| V4 | O invariante do Desfecho só vale no INSERT | low | É o mesmo achado do E6. | rejeitado |
| V5 | O caso HS256 não exercita o algoritmo | low | É o mesmo achado do E10. | patch (G5) |

## Design Notes

`favorites` nasce mínima porque `events.favorite_id` precisa de FK, e o SQLite não adiciona FK depois sem reconstruir a tabela. O item de Importação acrescenta as colunas. A lista dos 6 tipos de evento já entra no CHECK, porque mudar um CHECK também exige reconstrução.

Invariante do Desfecho (o NULL em CHECK passa, por isso o `coalesce`):

```sql
CHECK ((type = 'outcome') = (open_id IS NOT NULL)),
CHECK ((type = 'outcome') = (outcome IS NOT NULL)),
CHECK ((coalesce(outcome, '') = 'learned') = (length(trim(coalesce(lesson, ''))) > 0))
```

Testes com `node:test` em vez de Vitest: o item não tem JSX nem lógica de D1 além de um count. Troca-se para `@cloudflare/vitest-pool-workers` quando aparecer TSX ou consultas de verdade.

## Verification

**Commands:**
- `npm test` -- expected: todos os casos da matriz passam.
- `npm run typecheck` -- expected: sem erros.
- `npx wrangler d1 migrations apply DB --local` -- expected: aplica sem erro (valida o trigger no parser do wrangler).
- `curl -sI https://<url-publica>/` -- expected: 302 para `*.cloudflareaccess.com`.

**Manual checks (if no CLI):**
- No celular, logar pelo Access e ver `Favorites to Fire: 0 favoritos`.
