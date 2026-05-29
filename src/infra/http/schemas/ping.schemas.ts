import { z } from 'zod'

const PingResponseSchema = z
  .object({
    message: z.literal('pong'),
  })
  .meta({
    'x-examples': {
      success: {
        summary: '200 OK',
        value: {
          message: 'pong',
        },
      },
    },
  })

export const PingRouteSchema = {
  summary: 'Ping',
  description: 'Returns pong for a lightweight application check.',
  tags: ['Health'],
  response: {
    200: PingResponseSchema,
  },
}
