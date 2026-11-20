import * as _Http from 'http'
import { Socket } from 'net'

import { HttpServerManagerInterface, LoggerInterface } from './interfaces'
import { ServerConfig } from '../server-config'
import { registerShutdownSignals } from './shutdown-signals'

/**
 * Responsible for HTTP server lifecycle (start/stop)
 * Follows Single Responsibility Principle
 */
export class HttpServerManager implements HttpServerManagerInterface {
  private server: _Http.Server
  private connections: Set<Socket> = new Set()
  private app: _Http.RequestListener
  private config: ServerConfig
  private logger: LoggerInterface
  private onShutdown: () => Promise<void>

  constructor(
    app: _Http.RequestListener,
    config: ServerConfig,
    logger: LoggerInterface,
    onShutdown: () => Promise<void>
  ) {
    this.app = app
    this.config = config
    this.logger = logger
    this.onShutdown = onShutdown
    this.server = _Http.createServer(this.app)
    this.server.on('connection', (socket: Socket) => {
      this.connections.add(socket)
      socket.on('close', () => this.connections.delete(socket))
    })
  }

  async listen(port: number): Promise<void> {
    this.server.listen(port, () => {
      this.logger.info('Listening on port ' + port)
    })
  }

  async start(): Promise<void> {
    await this.listen(this.config.port)
    registerShutdownSignals(this.onShutdown)
  }

  setLogger(logger: LoggerInterface): void {
    this.logger = logger
  }

  async shutdown(): Promise<any> {
    this.logger.info('Shutting down')
    return new Promise<void>((resolve, reject) => {
      this.server.close((error?: NodeJS.ErrnoException) => {
        // Another owner (e.g. socket.io's io.close()) may already have closed the server
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
          reject(error)
          return
        }
        resolve()
      })
      // Long-lived connections (WebSockets) would otherwise hold close() open
      for (const socket of this.connections) {
        socket.destroy()
      }
    })
  }

  getServer(): _Http.Server {
    return this.server
  }
}
