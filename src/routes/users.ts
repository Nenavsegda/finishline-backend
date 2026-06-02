import { FastifyInstance } from 'fastify'
import { getPool } from '../plugins/db'
import { v4 as uuidv4 } from 'uuid'

export async function usersRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; name: string } }>(
    '/users/upsert',
    async (request, reply) => {
      const { email, name } = request.body
      const pool = getPool()

      const [rows] = await pool.query<any[]>('SELECT id FROM users WHERE email = ?', [email])
      let userId: string

      if (rows.length > 0) {
        userId = rows[0].id
      } else {
        userId = uuidv4()
        await pool.query('INSERT INTO users (id, email, name) VALUES (?, ?, ?)', [userId, email, name])
      }

      return { userId }
    }
  )
}
