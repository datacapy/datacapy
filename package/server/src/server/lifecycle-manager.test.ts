import { LifecycleManager } from './lifecycle-manager'

describe('LifecycleManager', () => {
  let manager: LifecycleManager

  beforeEach(() => {
    manager = new LifecycleManager()
  })

  describe('constructor()', () => {
    it('initializes with empty initialisers object', () => {
      const initialisers = manager.getInitialisers()

      expect(initialisers).toEqual({})
    })

    it('initializes with empty shutdown handlers object', () => {
      const shutdownHandlers = manager.getShutdownHandlers()

      expect(shutdownHandlers).toEqual({})
    })
  })

  describe('addInitialiser()', () => {
    it('adds initialiser to default stage', () => {
      const initialiser = jest.fn()

      manager.addInitialiser(initialiser)
      const initialisers = manager.getInitialisers()

      expect(initialisers['default']).toContain(initialiser)
    })

    it('adds initialiser to specified stage', () => {
      const initialiser = jest.fn()

      manager.addInitialiser(initialiser, 'custom')
      const initialisers = manager.getInitialisers()

      expect(initialisers['custom']).toContain(initialiser)
    })

    it('adds multiple initialisers to same stage', () => {
      const init1 = jest.fn()
      const init2 = jest.fn()

      manager.addInitialiser(init1, 'test')
      manager.addInitialiser(init2, 'test')
      const initialisers = manager.getInitialisers()

      expect(initialisers['test']).toHaveLength(2)
      expect(initialisers['test']).toContain(init1)
      expect(initialisers['test']).toContain(init2)
    })

    it('creates stage array if it does not exist', () => {
      const initialiser = jest.fn()

      manager.addInitialiser(initialiser, 'newStage')
      const initialisers = manager.getInitialisers()

      expect(initialisers['newStage']).toBeDefined()
      expect(Array.isArray(initialisers['newStage'])).toBe(true)
    })
  })

  describe('addInitialisers()', () => {
    it('adds multiple initialisers at once', () => {
      const init1 = jest.fn()
      const init2 = jest.fn()
      const init3 = jest.fn()

      manager.addInitialisers([init1, init2, init3])
      const initialisers = manager.getInitialisers()

      expect(initialisers['default']).toHaveLength(3)
      expect(initialisers['default']).toContain(init1)
      expect(initialisers['default']).toContain(init2)
      expect(initialisers['default']).toContain(init3)
    })

    it('adds initialisers to specified stage', () => {
      const init1 = jest.fn()
      const init2 = jest.fn()

      manager.addInitialisers([init1, init2], 'custom')
      const initialisers = manager.getInitialisers()

      expect(initialisers['custom']).toHaveLength(2)
    })

    it('handles empty array', () => {
      manager.addInitialisers([])
      const initialisers = manager.getInitialisers()

      expect(initialisers).toEqual({})
    })
  })

  describe('runInitialisers()', () => {
    it('runs all initialisers in default stage', async () => {
      const init1 = jest.fn()
      const init2 = jest.fn()

      manager.addInitialiser(init1)
      manager.addInitialiser(init2)

      await manager.runInitialisers(undefined, {})

      expect(init1).toHaveBeenCalled()
      expect(init2).toHaveBeenCalled()
    })

    it('runs initialisers in specified stage', async () => {
      const init1 = jest.fn()
      const init2 = jest.fn()

      manager.addInitialiser(init1, 'custom')
      manager.addInitialiser(init2, 'custom')

      await manager.runInitialisers('custom', {})

      expect(init1).toHaveBeenCalled()
      expect(init2).toHaveBeenCalled()
    })

    it('passes context to initialisers', async () => {
      const initialiser = jest.fn()
      const context = { foo: 'bar' }

      manager.addInitialiser(initialiser)
      await manager.runInitialisers(undefined, context)

      expect(initialiser).toHaveBeenCalledWith(context)
    })

    it('adds shutdown handler when initialiser returns function', async () => {
      const shutdownHandler = jest.fn()
      const initialiser = jest.fn().mockResolvedValue(shutdownHandler)

      manager.addInitialiser(initialiser)
      await manager.runInitialisers(undefined, {})

      const handlers = manager.getShutdownHandlers()
      expect(handlers['default']).toContain(shutdownHandler)
    })

    it('does not add shutdown handler when initialiser returns non-function', async () => {
      const initialiser = jest.fn().mockResolvedValue('not a function')

      manager.addInitialiser(initialiser)
      await manager.runInitialisers(undefined, {})

      const handlers = manager.getShutdownHandlers()
      expect(handlers).toEqual({})
    })

    it('does nothing when stage has no initialisers', async () => {
      await expect(
        manager.runInitialisers('nonexistent', {})
      ).resolves.toBeUndefined()
    })

    it('runs initialisers in order', async () => {
      const order: number[] = []
      const init1 = jest.fn(() => order.push(1))
      const init2 = jest.fn(() => order.push(2))
      const init3 = jest.fn(() => order.push(3))

      manager.addInitialiser(init1)
      manager.addInitialiser(init2)
      manager.addInitialiser(init3)

      await manager.runInitialisers(undefined, {})

      expect(order).toEqual([1, 2, 3])
    })
  })

  describe('addShutdownHandler()', () => {
    it('adds shutdown handler to default stage', () => {
      const handler = jest.fn()

      manager.addShutdownHandler(handler)
      const handlers = manager.getShutdownHandlers()

      expect(handlers['default']).toContain(handler)
    })

    it('adds shutdown handler to specified stage', () => {
      const handler = jest.fn()

      manager.addShutdownHandler(handler, 'custom')
      const handlers = manager.getShutdownHandlers()

      expect(handlers['custom']).toContain(handler)
    })

    it('adds handlers in reverse order (unshift)', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandler(handler1)
      manager.addShutdownHandler(handler2)
      const handlers = manager.getShutdownHandlers()

      expect(handlers['default'][0]).toBe(handler2)
      expect(handlers['default'][1]).toBe(handler1)
    })
  })

  describe('addShutdownHandlers()', () => {
    it('adds multiple shutdown handlers at once', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandlers([handler1, handler2])
      const handlers = manager.getShutdownHandlers()

      expect(handlers['default']).toHaveLength(2)
    })

    it('adds handlers to specified stage', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandlers([handler1, handler2], 'custom')
      const handlers = manager.getShutdownHandlers()

      expect(handlers['custom']).toHaveLength(2)
    })

    it('handles empty array', () => {
      manager.addShutdownHandlers([])
      const handlers = manager.getShutdownHandlers()

      expect(handlers).toEqual({})
    })
  })

  describe('runShutdownHandlers()', () => {
    it('runs all shutdown handlers in default stage', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandler(handler1)
      manager.addShutdownHandler(handler2)

      await manager.runShutdownHandlers()

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('runs handlers in specified stage', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandler(handler1, 'custom')
      manager.addShutdownHandler(handler2, 'custom')

      await manager.runShutdownHandlers('custom')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('does nothing when stage has no handlers', async () => {
      await expect(
        manager.runShutdownHandlers('nonexistent')
      ).resolves.toBeUndefined()
    })

    it('runs handlers in reverse order of addition', async () => {
      const order: number[] = []
      const handler1 = jest.fn(() => order.push(1))
      const handler2 = jest.fn(() => order.push(2))

      manager.addShutdownHandler(handler1)
      manager.addShutdownHandler(handler2)

      await manager.runShutdownHandlers()

      expect(order).toEqual([2, 1])
    })

    it('waits for async handlers to complete', async () => {
      const handler = jest.fn().mockResolvedValue(undefined)

      manager.addShutdownHandler(handler)
      await manager.runShutdownHandlers()

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('getInitialisers()', () => {
    it('returns empty object when no initialisers added', () => {
      const initialisers = manager.getInitialisers()

      expect(initialisers).toEqual({})
    })

    it('returns all initialisers by stage', () => {
      const init1 = jest.fn()
      const init2 = jest.fn()

      manager.addInitialiser(init1, 'stage1')
      manager.addInitialiser(init2, 'stage2')

      const initialisers = manager.getInitialisers()

      expect(initialisers['stage1']).toContain(init1)
      expect(initialisers['stage2']).toContain(init2)
    })
  })

  describe('getShutdownHandlers()', () => {
    it('returns empty object when no handlers added', () => {
      const handlers = manager.getShutdownHandlers()

      expect(handlers).toEqual({})
    })

    it('returns all shutdown handlers by stage', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      manager.addShutdownHandler(handler1, 'stage1')
      manager.addShutdownHandler(handler2, 'stage2')

      const handlers = manager.getShutdownHandlers()

      expect(handlers['stage1']).toContain(handler1)
      expect(handlers['stage2']).toContain(handler2)
    })
  })
})
