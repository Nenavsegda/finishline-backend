import { FastifyInstance } from 'fastify'
import { getPool } from '../plugins/db'
import { v4 as uuidv4 } from 'uuid'

const GOAL_LIMIT = 20

export async function goalsRoutes(app: FastifyInstance) {
  app.get('/goals', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [userId])
    return rows
  })

  app.post<{ Body: { title: string; target_amount: number; target_date: string } }>(
    '/goals',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string
      const { title, target_amount, target_date } = request.body
      if (!title || !target_amount || !target_date) {
        return reply.status(400).send({ error: 'title, target_amount and target_date are required' })
      }

      const pool = getPool()
      const [countRows] = await pool.query<any[]>(
        'SELECT COUNT(*) AS cnt FROM goals WHERE user_id = ? AND is_completed = 0 AND target_date >= CURDATE()',
        [userId]
      )
      if (countRows[0].cnt >= GOAL_LIMIT) {
        return reply.status(400).send({ error: 'Goal limit reached', limit: GOAL_LIMIT })
      }

      const id = uuidv4()
      await pool.query(
        'INSERT INTO goals (id, user_id, title, target_amount, target_date) VALUES (?, ?, ?, ?, ?)',
        [id, userId, title, target_amount, target_date]
      )

      const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ?', [id])
      return reply.status(201).send(rows[0])
    }
  )

  app.put<{ Params: { id: string }; Body: { title?: string; target_amount?: number; target_date?: string } }>(
    '/goals/:id',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string
      const pool = getPool()
      const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [
        request.params.id, userId,
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
    const userId = request.headers['x-user-id'] as string
    const pool = getPool()
    const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [
      request.params.id, userId,
    ])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    const newStatus = rows[0].is_active ? 0 : 1
    await pool.query('UPDATE goals SET is_active = ?, updated_at = NOW() WHERE id = ?', [
      newStatus, request.params.id,
    ])
    return { ...rows[0], is_active: newStatus }
  })

  app.patch<{ Params: { id: string } }>('/goals/:id/complete', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string
    const pool = getPool()
    const [rows] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [
      request.params.id, userId,
    ])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    await pool.query(
      'UPDATE goals SET is_completed = 1, is_active = 0, updated_at = NOW() WHERE id = ?',
      [request.params.id]
    )
    const [updated] = await pool.query<any[]>('SELECT * FROM goals WHERE id = ?', [request.params.id])
    return updated[0]
  })

  app.delete<{ Params: { id: string } }>('/goals/:id', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string
    const pool = getPool()
    const [rows] = await pool.query<any[]>('SELECT id FROM goals WHERE id = ? AND user_id = ?', [
      request.params.id, userId,
    ])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    await pool.query('DELETE FROM goals WHERE id = ?', [request.params.id])
    return reply.status(204).send()
  })

  app.get('/goals/summary', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string
    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      'SELECT target_amount, target_date FROM goals WHERE user_id = ? AND is_active = 1 AND is_completed = 0 AND target_date >= CURDATE()',
      [userId]
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let totalDaily = 0, totalWeekly = 0, totalMonthly = 0

    for (const goal of rows) {
      const targetDate = new Date(goal.target_date)
      targetDate.setHours(0, 0, 0, 0)
      const daysLeft = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
      const amount = Number(goal.target_amount)
      const daily = amount / daysLeft
      totalDaily += daily
      totalWeekly += Math.min(amount, daily * 7)
      totalMonthly += Math.min(amount, daily * 30)
    }

    return {
      daily: Math.ceil(totalDaily * 100) / 100,
      weekly: Math.ceil(totalWeekly * 100) / 100,
      monthly: Math.ceil(totalMonthly * 100) / 100,
    }
  })
}
