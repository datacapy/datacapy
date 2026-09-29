import express from 'express'

import { ExpressAppManagerInterface, LoggerInterface } from './interfaces'
import { ServerConfig } from '../server-config'

/**
 * Responsible for Express application and router setup
 * Follows Single Responsibility Principle
 */
export class ExpressAppManager implements ExpressAppManagerInterface {
  private app: express.Application
  private router: express.Router
  private logger: LoggerInterface

  constructor(config: ServerConfig, logger: LoggerInterface) {
    this.app = express()
    this.router = express.Router()
    this.logger = logger
  }

  getApp(): express.Application {
    return this.app
  }

  getRouter(): express.Router {
    return this.router
  }

  mountRouter(path: string): void {
    this.app.use(path, this.router)
  }

  setupErrorHandler(logger: LoggerInterface): void {
    this.logger = logger
    this.app.use((err, req, res, next) => {
      this.logger.error({ err, req, res })
      res.status(500).send('Something broke!')
      next()
    })
  }
}
