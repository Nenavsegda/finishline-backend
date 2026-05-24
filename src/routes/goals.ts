import { FastifyInstance } from 'fastify'
import { getPool } from '../plugins/db'
import { verifyToken } from '../plugins/jwt'
import { v4 as uuidv4 } from 'uuid'

function getUser(request: any) {
  const token = request.cookies?.token
  if (!token) return null
  try {
    return verifyToken(token)
  } catch {
    return null
  }
}

export async function goalsRoutes(app: FastifyInstance) {
  app.get('/goals', async (request, reply) => {
    const user = getUser(request)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [user.userId])
    return rows
  })

  app.post<{ Body: { title: string; target_amount: number; target_date: string } }>(
    '/goals',
    async (request, reply) => {
      const user = getUser(request)
      if (!user) return reply.status(401).send({ error: 'Unauthorized' })

      const { title, target_amount, target_date } = request.body
      if (!title || !target_amount || !target_date) {
        return reply.status(400).send({ error: 'title, target_amount and target_date are required' })
      }

      const id = uuidv4()
      const pool = getPool()
      await pool.query(
        'INSERT INTO goals (id, user_id, title, target_amount, target_date) VALUES (?, ?, ?, ?, ?)',
        [id, user.userId, title, target_amount, target_date]
      )

      const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ?', [id])
      return reply.status(201).send(rows[0])
    }
  )

  app.put<{ Params: { id: string }; Body: { title?: string; target_amount?: number; target_date?: string } }>(
    '/goals/:id',
    async (request, reply) => {
      const user = getUser(request)
      if (!user) return reply.status(401).send({ error: 'Unauthorized' })

      const pool = getPool()
      const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [
        request.params.id,
        user.userId,
      ])
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

      const { title, target_amount, target_date } = request.body
      await pool.query(
        'UPDATE goals SET title = COALESCE(?, title), target_amount = COALESCE(?, target_amount), target_date = COALESCE(?, target_date), updated_at = NOW() WHERE id = ?',
        [title ?? null, target_amount ?? null, target_date ?? null, request.params.id]
      )

      const [updated] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ?', [request.params.id])
      return updated[0]
    }
  )

  app.patch<{ Params: { id: string } }>('/goals/:id/toggle', async (request, reply) => {
    const user = getUser(request)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const pool = getPool()
    const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [
      request.params.id,
      user.userId,
    ])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    const newStatus = rows[0].is_active ? 0 : 1
    await pool.query('UPDATE goals SET is_active = ?, updated_at = NOW() WHERE id = ?', [
      newStatus,
      request.params.id,
    ])

    return { ...rows[0], is_active: newStatus }
  })

  app.delete<{ Params: { id: string } }>('/goals/:id', async (request, reply) => {
    const user = getUser(request)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const pool = getPool()
    const [rows] = await pool.query<any[]>('SELECT id FROM goals WHERE id = ? AND user_id = ?', [
      request.params.id,
      user.userId,
    ])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    await pool.query('DELETE FROM goals WHERE id = ?', [request.params.id])
    return reply.status(204).send()
  })

  app.get('/goals/summary', async (request, reply) => {
    const user = getUser(request)
    if (!user) return reply.status(401).send({ error: 'Unauthorized' })

    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      'SELECT target_amount, target_date FROM goals WHERE user_id = ? AND is_active = 1',
      [user.userId]
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let totalDaily = 0
    for (const goal of rows) {
      const targetDate = new Date(goal.target_date)
      targetDate.setHours(0, 0, 0, 0)
      const daysLeft = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
      totalDaily += Number(goal.target_amount) / daysLeft
    }

    return {
      daily: Math.ceil(totalDaily * 100) / 100,
      weekly: Math.ceil(totalDaily * 7 * 100) / 100,
      monthly: Math.ceil(totalDaily * 30 * 100) / 100,
    }
  })
}
