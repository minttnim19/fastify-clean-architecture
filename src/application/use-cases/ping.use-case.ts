export type PingResponse = {
  message: 'pong'
}

export class PingUseCase {
  execute(): PingResponse {
    return { message: 'pong' }
  }
}
