import { z } from 'zod'

const HealthzResponseSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: z.string(),
    uptime: z.number(),
    environment: z.string().optional(),
  })
  .meta({
    'x-examples': {
      success: {
        summary: '200 OK',
        value: {
          status: 'ok',
          timestamp: '2026-05-05T00:00:00.000Z',
          uptime: 123.456,
          environment: 'development',
        },
      },
    },
  })

export const HealthzRouteSchema = {
  summary: 'Health check',
  description: 'Returns service liveness information for load balancers and uptime checks.',
  tags: ['Health'],
  response: {
    200: HealthzResponseSchema,
  },
}
