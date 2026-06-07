import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestContext = {
  correlatorId?: string
  channel?: string
}

const als = new AsyncLocalStorage<RequestContext>()

export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return als.run(ctx, fn)
  },
  set(ctx: RequestContext): void {
    als.enterWith(ctx)
  },
  get(): RequestContext | undefined {
    return als.getStore()
  },
}
