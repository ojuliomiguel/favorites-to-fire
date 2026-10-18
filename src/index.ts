import { Hono } from 'hono'
import { verifyWithJwks } from 'hono/jwt'

const app = new Hono<{ Bindings: Env }>()

app.use(async (c, next) => {
  const iss = c.env.ACCESS_TEAM_DOMAIN
  const aud = c.env.ACCESS_AUD
  if (!iss || !aud) return c.text('Access not configured', 500)

  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) return c.text('Forbidden', 403)
  try {
    const payload = await verifyWithJwks(token, {
      jwks_uri: `${iss}/cdn-cgi/access/certs`,
      allowedAlgorithms: ['RS256'],
      verification: { iss, aud },
    })
    if (typeof payload.exp !== 'number') throw Object.assign(new Error(), { name: 'JwtMissingExp' })
  } catch (e) {
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
