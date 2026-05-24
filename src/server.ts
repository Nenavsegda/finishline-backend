import 'dotenv/config'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { authRoutes } from './routes/auth'
import { goalsRoutes } from './routes/goals'

const app = Fastify({ logger: true })

async function start() {
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  await app.register(cookie)

  await app.register(authRoutes)
  await app.register(goalsRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: 4000, host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
