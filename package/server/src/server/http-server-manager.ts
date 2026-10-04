import * as _Http from 'http'
import { Socket } from 'net'
import express from 'express'

import { HttpServerManagerInterface, LoggerInterface } from './interfaces'
import { ServerConfig } from '../server-config'

/**
 * Responsible for HTTP server lifecycle (start/stop)
 * Follows Single Responsibility Principle
 */
export class HttpServerManager implements HttpServerManagerInterface {
  private server: _Http.Server
  private connections: Set<Socket> = new Set()
  private app: express.Application
  private config: ServerConfig
  private logger: LoggerInterface
  private onShutdown: () => Promise<void>

  constructor(
    app: express.Application,
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

  async start(): Promise<void> {
    this.server.listen(this.config.port, () => {
      this.logger.info('Listening on port ' + this.config.port)
    })

    process.on('SIGINT', () => {
      this.onShutdown().then(() => {
        setTimeout(function () {
          process.exit(0)
        }, 5000)
      })
    })

    process.on('SIGTERM', () => {
      this.onShutdown().then(() => {
        setTimeout(function () {
          process.exit(0)
        }, 5000)
      })
    })
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
