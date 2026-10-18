import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { sign } from 'hono/jwt'
import app from '../src/index.ts'

const MIGRATION = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8')
const TEAM = 'https://team.cloudflareaccess.com'
const DOWN = 'https://down.cloudflareaccess.com'
const AUD = 'aud-tag'

function freshDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(MIGRATION)
  return db
}

async function keyPair(kid: string, hash = 'SHA-256', alg = 'RS256') {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash },
    true,
    ['sign', 'verify'],
  )
  return {
    pub: { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid },
    priv: { ...(await crypto.subtle.exportKey('jwk', privateKey)), kid, alg },
    alg,
  }
}

const good = await keyPair('k1')
const impostor = await keyPair('k1')
const stranger = await keyPair('k2')
const rs512 = await keyPair('k3', 'SHA-512', 'RS512')

let fetchCalls = 0
globalThis.fetch = async (input) => {
  fetchCalls++
  if (String(input) === `${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [good.pub, rs512.pub] })
  if (String(input) === `${DOWN}/cdn-cgi/access/certs`) return new Response('unavailable', { status: 503 })
  return new Response('not found', { status: 404 })
}

const sqlite = freshDb()
sqlite.exec("INSERT INTO favorites (url) VALUES ('https://a.example'), ('https://b.example')")
let dbCalls = 0
const DB = {
  prepare: (sql: string) => ({
    first: async () => {
      dbCalls++
      return sqlite.prepare(sql).get()
    },
  }),
}

const now = () => Math.floor(Date.now() / 1000)
const claims = (over: Record<string, unknown> = {}) => ({ iss: TEAM, aud: [AUD], exp: now() + 300, ...over })
const jwt = (key: { priv: object; alg: string }, over?: Record<string, unknown>) =>
  sign(claims(over), key.priv as never, key.alg as never)

async function hit(token?: string, env: Record<string, unknown> = {}, path = '/', method = 'GET') {
  fetchCalls = 0
  dbCalls = 0
  const headers: Record<string, string> = token ? { 'Cf-Access-Jwt-Assertion': token } : {}
  return app.request(`http://worker${path}`, { method, headers }, { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, DB, ...env })
}

test('valid JWT: 200 with the favorites count from D1', async () => {
  const res = await hit(await jwt(good))
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'Favorites to Fire: 2 favoritos')
  assert.equal(dbCalls, 1)
})

test('missing header: 403 without touching the JWKS or D1', async () => {
  const res = await hit()
  assert.equal(res.status, 403)
  assert.equal(fetchCalls, 0)
  assert.equal(dbCalls, 0)
})

test('middleware guards every route, not just GET /', async () => {
  assert.equal((await hit(undefined, {}, '/nope')).status, 403)
  assert.equal((await hit(undefined, {}, '/', 'POST')).status, 403)
  const res = await hit(await jwt(good), { ACCESS_AUD: '' }, '/nope')
  assert.equal(res.status, 500)
  assert.equal(fetchCalls, 0)
})

test('JWKS unavailable: 403 without touching D1', async () => {
  const res = await hit(await jwt(good, { iss: DOWN }), { ACCESS_TEAM_DOMAIN: DOWN })
  assert.equal(res.status, 403)
  assert.equal(fetchCalls, 1)
  assert.equal(dbCalls, 0)
})

const invalid: Record<string, () => Promise<string>> = {
  'wrong signature': () => jwt(impostor),
  'unknown kid': () => jwt(stranger),
  'wrong aud': () => jwt(good, { aud: ['other'] }),
  'wrong iss': () => jwt(good, { iss: 'https://evil.cloudflareaccess.com' }),
  expired: () => jwt(good, { exp: now() - 10 }),
  'no exp': () => jwt(good, { exp: undefined }),
  'algorithm other than RS256': () => jwt(rs512),
  'HS256 token': () => sign(claims(), { kty: 'oct', k: 'c2VjcmV0', alg: 'HS256', kid: 'k1' }),
  garbage: async () => 'not.a.jwt',
}
for (const [name, make] of Object.entries(invalid)) {
  test(`invalid JWT (${name}): 403 without touching D1`, async () => {
    const res = await hit(await make())
    assert.equal(res.status, 403)
    assert.equal(dbCalls, 0)
  })
}

for (const empty of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD']) {
  for (const value of ['', undefined]) {
    test(`${empty} = ${JSON.stringify(value)}: 500, fails closed even with a valid JWT`, async () => {
      const res = await hit(await jwt(good), { [empty]: value })
      assert.equal(res.status, 500)
      assert.equal(fetchCalls, 0)
      assert.equal(dbCalls, 0)
    })
  }
}

function schema() {
  const db = freshDb()
  db.exec("INSERT INTO favorites (id, url) VALUES (1, 'https://a.example'), (2, 'https://b.example'), (3, 'https://c.example')")
  const insert = db.prepare('INSERT INTO events (favorite_id, type, open_id, outcome, lesson) VALUES (?, ?, ?, ?, ?)')
  const ev = (fav: number, type: string, f: { open_id?: number; outcome?: string; lesson?: string } = {}) =>
    Number(insert.run(fav, type, f.open_id ?? null, f.outcome ?? null, f.lesson ?? null).lastInsertRowid)
  return { db, ev, openOf1: ev(1, 'open'), openOf2: ev(2, 'open'), skipOf1: ev(1, 'skip') }
}

test('valid outcome: closes an open of the same favorite', () => {
  const { ev, openOf1, openOf2 } = schema()
  ev(1, 'outcome', { open_id: openOf1, outcome: 'consumed' })
  ev(2, 'outcome', { open_id: openOf2, outcome: 'learned', lesson: 'something stuck' })
  ev(3, 'outcome', { open_id: ev(3, 'open'), outcome: 'junk' })
})

const TRIGGER = /open event of the same favorite/
test('orphan outcome is rejected', () => {
  const { ev, openOf2, skipOf1 } = schema()
  assert.throws(() => ev(1, 'outcome', { outcome: 'consumed' }), TRIGGER, 'no open_id')
  assert.throws(() => ev(1, 'outcome', { open_id: openOf2, outcome: 'consumed' }), TRIGGER, 'open of another favorite')
  assert.throws(() => ev(1, 'outcome', { open_id: skipOf1, outcome: 'consumed' }), TRIGGER, 'event that is not an open')
  assert.throws(() => ev(1, 'outcome', { open_id: 999, outcome: 'consumed' }), TRIGGER, 'nonexistent event')
})

test('duplicate outcome for the same open is rejected', () => {
  const { ev, openOf1 } = schema()
  ev(1, 'outcome', { open_id: openOf1, outcome: 'consumed' })
  assert.throws(() => ev(1, 'outcome', { open_id: openOf1, outcome: 'junk' }), /UNIQUE/)
})

test('a favorite has at most one outcome, even after a new open', () => {
  const { ev, openOf1 } = schema()
  ev(1, 'outcome', { open_id: openOf1, outcome: 'consumed' })
  const reopen = ev(1, 'open')
  assert.throws(() => ev(1, 'outcome', { open_id: reopen, outcome: 'junk' }), /UNIQUE/)
})

test('favorite_id and url constraints hold', () => {
  const { db, ev } = schema()
  assert.throws(() => ev(999, 'skip'), /FOREIGN KEY/)
  assert.throws(() => ev(null as never, 'skip'), /NOT NULL/)
  assert.throws(() => db.exec("INSERT INTO favorites (url) VALUES ('https://a.example')"), /UNIQUE/)
  assert.throws(() => db.exec('INSERT INTO favorites (url) VALUES (NULL)'), /NOT NULL/)
})

test('learned without a lesson is rejected', () => {
  const { ev, openOf1 } = schema()
  for (const lesson of [undefined, '', '   ', '\t\n'])
    assert.throws(() => ev(1, 'outcome', { open_id: openOf1, outcome: 'learned', lesson }), /CHECK/)
})

test('outcome fields outside an outcome are rejected', () => {
  const { ev, openOf1 } = schema()
  assert.throws(() => ev(1, 'skip', { open_id: openOf1 }), /CHECK/)
  assert.throws(() => ev(1, 'skip', { outcome: 'consumed' }), /CHECK/)
  assert.throws(() => ev(1, 'skip', { lesson: 'x' }), /CHECK/)
  assert.throws(() => ev(1, 'skip', { lesson: '' }), /CHECK/)
  assert.throws(() => ev(1, 'outcome', { open_id: openOf1, outcome: 'consumed', lesson: 'x' }), /CHECK/)
})

test('only the six event types and three outcomes exist', () => {
  const { ev, openOf1 } = schema()
  for (const type of ['triage', 'flip', 'rescue', 'skip', 'open']) ev(1, type)
  assert.throws(() => ev(1, 'like'), /CHECK/)
  assert.throws(() => ev(1, 'outcome', { open_id: openOf1, outcome: 'meh' }), /CHECK/)
})
