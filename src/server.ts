import 'dotenv/config'
import Fastify from 'fastify'
import { goalsRoutes } from './routes/goals'
import { usersRoutes } from './routes/users'

const app = Fastify({ logger: true })
const INTERNAL_TOKEN = process.env.INTERNAL_API_SECRET!

async function start() {
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health') return
    if (request.headers['x-internal-token'] !== INTERNAL_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  await app.register(usersRoutes)
  await app.register(goalsRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: 4000, host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
