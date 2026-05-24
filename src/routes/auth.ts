import { FastifyInstance } from 'fastify'
import { getPool } from '../plugins/db'
import { signToken, verifyToken } from '../plugins/jwt'
import { v4 as uuidv4 } from 'uuid'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/google', async (request, reply) => {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: 'openid email profile',
      hd: process.env.GOOGLE_ALLOWED_DOMAIN!,
      access_type: 'online',
    })
    return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
  })

  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/auth/google/callback',
    async (request, reply) => {
      const { code, error } = request.query
      const frontendUrl = process.env.FRONTEND_URL!

      if (error || !code) {
        return reply.redirect(`${frontendUrl}/?error=access_denied`)
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenRes.ok) {
        return reply.redirect(`${frontendUrl}/?error=token_exchange_failed`)
      }

      const { access_token } = (await tokenRes.json()) as { access_token: string }

      const profileRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      })

      if (!profileRes.ok) {
        return reply.redirect(`${frontendUrl}/?error=profile_fetch_failed`)
      }

      const profile = (await profileRes.json()) as { email: string; name: string }
      const pool = getPool()

      const [rows] = await pool.query<any[]>('SELECT id FROM users WHERE email = ?', [profile.email])
      let userId: string

      if (rows.length > 0) {
        userId = rows[0].id
      } else {
        userId = uuidv4()
        await pool.query('INSERT INTO users (id, email, name) VALUES (?, ?, ?)', [
          userId,
          profile.email,
          profile.name,
        ])
      }

      const token = signToken({ userId, email: profile.email })

      reply.setCookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production',
      })

      return reply.redirect(`${frontendUrl}/goals`)
    }
  )

  app.get('/auth/me', async (request, reply) => {
    const token = request.cookies?.token
    if (!token) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      const payload = verifyToken(token)
      return { userId: payload.userId, email: payload.email }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })
}
