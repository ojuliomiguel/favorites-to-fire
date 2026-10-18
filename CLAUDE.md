# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal, single-user app to clear a backlog of saved favorites (X, YouTube, Edge): AI proposes triage, the owner approves and consumes, a game tracks it. Cloudflare Workers + D1, Hono, TypeScript.

## Read first

- `SPEC.md` — product spec (pt-BR): favorite lifecycle, sources, AI, game rules, stack, and the increment checklist (§8). Built incrementally; screens emerge per increment, the spec does not fix the list.
- `CONTEXT.md` — ubiquitous language (pt-BR glossary with terms to avoid). Use these terms in UI copy and discussion.
- `_bmad-output/implementation-artifacts/spec-*.md` — per-story specs (BMad workflow). The `<frozen-after-approval>` block is owner-owned; don't edit it.

## Commands

```bash
npm test                    # node:test, all suites (Node >=22.13, uses node:sqlite + strip-types)
node --no-warnings --experimental-strip-types --test --test-name-pattern="<name>" test/worker.test.ts
                            # single test (`npm test -- --test-name-pattern` does NOT filter)
npm run typecheck           # wrangler types (regenerates worker-configuration.d.ts, gitignored) + tsc
npm run dev                 # wrangler dev; needs ACCESS_TEAM_DOMAIN / ACCESS_AUD in .dev.vars
npx wrangler d1 migrations apply DB --local    # --remote for prod
npm run deploy
```

Remote effects (`deploy`, `--remote`, `wrangler secret put`, `d1 create`) are run by the owner, not by agents.

## Architecture

- `src/index.ts` — one Hono app, default export. A global middleware validates the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) on **every** route as a second barrier behind Access: RS256 only, `iss` = `ACCESS_TEAM_DOMAIN`, `aud` contains `ACCESS_AUD`, `exp` required. Any failure → 403; missing config → 500 (fail closed, because `verifyWithJwks` silently skips empty iss/aud). There is deliberately no local auth bypass, so `wrangler dev` returns 403 without a real Access token.
- Access config lives in Worker **secrets** (`secrets.required` in `wrangler.jsonc`), never in `vars`. `preview_urls: false`; `workers.dev` is only enabled behind Access.
- `migrations/*.sql` — D1 schema. Integrity rules live in the DB (CHECK, UNIQUE, triggers), not in app code. `events` is the source of truth: XP, level, streak, achievements and stats are always recomputed from events, never stored as a running score. New event payloads arrive via `ALTER TABLE ADD COLUMN`; changing a CHECK or adding an FK requires a table rebuild in SQLite, so get those right the first time.
- Tables are added only by the increment that uses them (no speculative tables for sources, scopes, proposals).
- Planned stack per SPEC §7: server-rendered Hono JSX, native HTML forms, near-zero client JS, PWA manifest, AI via OpenAI-compatible API with base URL/model in Worker vars and key in a secret.

## Tests

`test/worker.test.ts` calls `app.request(url, init, env)` directly: it generates RSA keys, signs JWTs with `hono/jwt` `sign`, stubs `globalThis.fetch` to serve the JWKS, and passes a fake `DB` backed by in-memory `node:sqlite` with the migration applied. Schema invariants are tested by inserting into that SQLite DB. Switch to `@cloudflare/vitest-pool-workers` once TSX or real D1 queries appear. `test/` is not typechecked.

## Conventions

- Code, identifiers, SQL, comments and commits in English; UI text in pt-BR. Term map: Favorito→favorite, Evento→event, Triagem→triage, Inversão→flip, Resgate→rescue, Pular→skip, Abrir→open, Desfecho→outcome, Aprendi/Consumi/Lixo→learned/consumed/junk, Lição→lesson.
- Comments in `.ts`/`.tsx` code are forbidden, including `// ponytail:` markers. Intent goes in names, tests, and commit messages.
