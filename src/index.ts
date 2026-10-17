import { Hono } from 'hono'
import { verifyWithJwks } from 'hono/jwt'

const app = new Hono<{ Bindings: Env }>()

// Second barrier behind Cloudflare Access: every route, fail closed.
app.use(async (c, next) => {
  const iss: string = c.env.ACCESS_TEAM_DOMAIN
  const aud: string = c.env.ACCESS_AUD
  // verifyWithJwks silently skips empty iss/aud checks, so refuse to serve without them.
  if (!iss || !aud) return c.text('Access not configured', 500)

  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) return c.text('Forbidden', 403)
  try {
    // ponytail: fetches the JWKS on every request; cache it if traffic ever matters.
    const payload = await verifyWithJwks(token, {
      jwks_uri: `${iss}/cdn-cgi/access/certs`,
      allowedAlgorithms: ['RS256'],
      verification: { iss, aud },
    })
    // hono only checks exp when present; a valid Access JWT always has one.
    if (typeof payload.exp !== 'number') throw Object.assign(new Error(), { name: 'JwtMissingExp' })
  } catch (e) {
    // Name only: hono error messages embed the token.
    console.warn('access denied', (e as Error).name)
    return c.text('Forbidden', 403)
  }
  await next()
})

app.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT count(*) AS n FROM favorites').first<{ n: number }>()
  return c.text(`Favorites to Fire: ${row?.n ?? 0} favoritos`)
})

export default app
