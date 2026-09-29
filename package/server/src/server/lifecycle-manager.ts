import { LifecycleManagerInterface } from './interfaces'

/**
 * Responsible for initializer and shutdown handler orchestration
 * Follows Single Responsibility Principle
 */
export class LifecycleManager implements LifecycleManagerInterface {
  private initialisers: { [key: string]: any[] }
  private shutdownHandlers: { [key: string]: any[] }

  constructor() {
    this.initialisers = {}
    this.shutdownHandlers = {}
  }

  addInitialiser(initialiser: Function, stage?: string): void {
    stage = stage ? stage : 'default'
    if (this.initialisers[stage] === undefined) {
      this.initialisers[stage] = []
    }
    this.initialisers[stage].push(initialiser)
  }

  addInitialisers(initialisers: Function[], stage?: string): void {
    initialisers.forEach((initialiser) => {
      this.addInitialiser(initialiser, stage)
    })
  }

  async runInitialisers(
    stage: string | undefined,
    context: any
  ): Promise<void> {
    stage = stage ? stage : 'default'
    if (this.initialisers[stage]) {
      for (const initFunction of this.initialisers[stage]) {
        const shutdownHandler = await Promise.resolve(initFunction(context))
        if (typeof shutdownHandler == 'function') {
          this.addShutdownHandler(shutdownHandler, stage)
        }
      }
    }
  }

  addShutdownHandler(handler: Function, stage?: string): void {
    stage = stage ? stage : 'default'
    if (this.shutdownHandlers[stage] === undefined) {
      this.shutdownHandlers[stage] = []
    }
    this.shutdownHandlers[stage].unshift(handler)
  }

  addShutdownHandlers(handlers: Function[], stage?: string): void {
    handlers.forEach((handler) => {
      this.addShutdownHandler(handler, stage)
    })
  }

  async runShutdownHandlers(stage?: string): Promise<void> {
    stage = stage ? stage : 'default'
    if (this.shutdownHandlers[stage] && this.shutdownHandlers[stage].length) {
      for (const handler of this.shutdownHandlers[stage]) {
        await Promise.resolve(handler())
      }
    }
  }

  // Expose internal state for backward compatibility
  getInitialisers(): { [key: string]: any[] } {
    return this.initialisers
  }

  getShutdownHandlers(): { [key: string]: any[] } {
    return this.shutdownHandlers
  }
}
