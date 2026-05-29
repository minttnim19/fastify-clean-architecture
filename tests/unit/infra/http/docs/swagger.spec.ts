import { describe, expect, it, vi } from 'vitest'

import { createSwaggerUiOptions, swaggerOptions, swaggerUiOptions } from '@/infra/http/docs/swagger'

function createSwaggerAuthContext() {
  const options = createSwaggerUiOptions({
    username: 'swagger',
    password: 'secret',
  })
  const onRequest = options.uiHooks?.onRequest

  expect(onRequest).toEqual(expect.any(Function))
  if (!onRequest) throw new Error('Expected swagger auth hook')

  const header = vi.fn()
  const status = vi.fn()
  const send = vi.fn()
  const reply = {
    header,
    status,
    send,
  } as unknown as Parameters<typeof onRequest>[1]
  header.mockReturnValue(reply)
  status.mockReturnValue(reply)
  const done = vi.fn() as Parameters<typeof onRequest>[2]

  return { done, header, onRequest, reply, send, status }
}

describe('swagger docs config', () => {
  it('exports OpenAPI and Swagger UI options', () => {
    expect(swaggerOptions.openapi?.info).toEqual({
      title: 'Template XYZ Service',
      description: 'Template API documentation for health, metrics, and ping endpoints.',
      version: '1.0.0',
    })
    expect(swaggerOptions.openapi?.servers).toEqual([
      {
        url: '/xyz',
        description: 'Application base path',
      },
    ])
    expect(swaggerOptions.transform).toEqual(expect.any(Function))
    expect(swaggerUiOptions).toEqual({
      routePrefix: '/xyz/docs',
      staticCSP: true,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    })
  })

  it('adds basic auth hook when credentials are provided', () => {
    const { done, onRequest, reply, status } = createSwaggerAuthContext()

    const authorization = `Basic ${Buffer.from('swagger:secret').toString('base64')}`
    const request = { headers: { authorization } } as Parameters<typeof onRequest>[0]

    onRequest.call({} as ThisParameterType<typeof onRequest>, request, reply, done)

    expect(done).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })

  it('rejects swagger requests with invalid basic auth credentials', () => {
    const { done, header, onRequest, reply, send, status } = createSwaggerAuthContext()

    const request = {
      headers: {
        authorization: `Basic ${Buffer.from('swagger:wrong').toString('base64')}`,
      },
    } as Parameters<typeof onRequest>[0]

    onRequest.call({} as ThisParameterType<typeof onRequest>, request, reply, done)

    expect(done).not.toHaveBeenCalled()
    expect(header).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Swagger Documentation"')
    expect(status).toHaveBeenCalledWith(401)
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        timestamp: expect.any(String),
      },
    })
  })

  it.each([
    { authorization: undefined, summary: 'missing authorization header' },
    { authorization: 'Bearer token', summary: 'unsupported authorization scheme' },
    {
      authorization: `Basic ${Buffer.from('invalid-credentials').toString('base64')}`,
      summary: 'malformed basic auth payload',
    },
  ])('rejects swagger requests with $summary', ({ authorization }) => {
    const { done, header, onRequest, reply, send, status } = createSwaggerAuthContext()
    const request = {
      headers: authorization ? { authorization } : {},
    } as Parameters<typeof onRequest>[0]

    onRequest.call({} as ThisParameterType<typeof onRequest>, request, reply, done)

    expect(done).not.toHaveBeenCalled()
    expect(header).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Swagger Documentation"')
    expect(status).toHaveBeenCalledWith(401)
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        timestamp: expect.any(String),
      },
    })
  })
})
