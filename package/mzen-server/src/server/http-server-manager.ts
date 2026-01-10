import * as _Http from 'http'
import express from 'express'

import { HttpServerManagerInterface, LoggerInterface } from './interfaces'
import { ServerConfig } from '../server-config'

/**
 * Responsible for HTTP server lifecycle (start/stop)
 * Follows Single Responsibility Principle
 */
export class HttpServerManager implements HttpServerManagerInterface {
  private server: _Http.Server | null
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
    this.server = null
  }

  async start(): Promise<void> {
    this.server = this.app.listen(this.config.port, () => {
      this.logger.info('Listening on port ' + this.config.port)
    })

    process.on('SIGINT', () => {
      this.onShutdown().then(() => {
        setTimeout(function () {
          process.exit(0)
        }, 5000)
      })
    })
  }

  async shutdown(): Promise<any> {
    this.logger.info('Shutting down')
    return this.server ? this.server.close() : undefined
  }

  getServer(): _Http.Server | null {
    return this.server
  }
}
