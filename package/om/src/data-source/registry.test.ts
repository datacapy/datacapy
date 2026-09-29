import { DataSourceRegistry } from './registry'
import { DataSourceInterface } from './interface'
import { allowConsole } from '../test-utils/consoleGuard'

function makeFakeDataSource(
  hasActiveLeases: () => boolean
): jest.Mocked<Pick<DataSourceInterface, 'close' | 'hasActiveLeases'>> {
  return {
    close: jest.fn().mockResolvedValue(undefined),
    hasActiveLeases: jest.fn(hasActiveLeases),
  }
}

describe('DataSourceRegistry', () => {
  describe('eviction and active leases', () => {
    it('does not evict a refCount === 0 entry that still has an active transaction lease', async () => {
      await allowConsole(
        'All datasources have active references, cannot evict',
        async () => {
          const registry = new DataSourceRegistry({
            maxSize: 1,
            logger: console,
          })

          let leased = true
          const leasedDataSource = makeFakeDataSource(() => leased)
          await registry.getOrCreate('a', async () => leasedDataSource as any)
          registry.release('a') // refCount back to 0, but hasActiveLeases() still true

          // Creating a second entry exceeds maxSize and triggers evictLRU(), which must skip
          // the leased entry rather than closing it out from under the in-progress transaction.
          const otherDataSource = makeFakeDataSource(() => false)
          await registry.getOrCreate('b', async () => otherDataSource as any)
          registry.release('b')

          expect(leasedDataSource.close).not.toHaveBeenCalled()
          expect(registry.has('a')).toBe(true)

          leased = false
          await registry.close()
        }
      )
    })

    it('evicts a refCount === 0 entry once its active leases clear', async () => {
      const registry = new DataSourceRegistry({ maxSize: 1, logger: console })

      let leased = true
      const leasedDataSource = makeFakeDataSource(() => leased)
      await registry.getOrCreate('a', async () => leasedDataSource as any)
      registry.release('a')

      leased = false // lease committed/rolled back before the next eviction attempt

      const otherDataSource = makeFakeDataSource(() => false)
      await registry.getOrCreate('b', async () => otherDataSource as any)
      registry.release('b')

      expect(leasedDataSource.close).toHaveBeenCalledTimes(1)
      expect(registry.has('a')).toBe(false)

      await registry.close()
    })

    it('remove() waits for an active lease to clear before closing the datasource', async () => {
      const registry = new DataSourceRegistry({ logger: console })

      let leased = true
      const dataSource = makeFakeDataSource(() => leased)
      await registry.getOrCreate('a', async () => dataSource as any)
      registry.release('a')

      const removePromise = registry.remove('a', 'test')

      // Still within the wait loop - must not have closed yet.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(dataSource.close).not.toHaveBeenCalled()

      leased = false
      await removePromise

      expect(dataSource.close).toHaveBeenCalledTimes(1)

      await registry.close()
    })

    it('does not force-close a still-in-use datasource once the wait timeout elapses, and leaves it in the registry', async () => {
      await allowConsole(
        'Timed out waiting for active references/leases to clear',
        async () => {
          const registry = new DataSourceRegistry({
            removeWaitTimeout: 100,
            logger: console,
          })

          const dataSource = makeFakeDataSource(() => false) // no active leases
          await registry.getOrCreate('a', async () => dataSource as any)
          // Do NOT release - refCount stays 1, simulating an in-flight caller still using it.

          await registry.remove('a', 'test')

          expect(dataSource.close).not.toHaveBeenCalled()
          expect(registry.has('a')).toBe(true)

          registry.release('a')
          await registry.close()
        }
      )
    })
  })

  describe('concurrent getOrCreate', () => {
    it('dedupes concurrent creations for the same key into a single factory call', async () => {
      const registry = new DataSourceRegistry({ logger: console })

      const dataSource = makeFakeDataSource(() => false)
      const factory = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return dataSource as any
      })

      const [first, second] = await Promise.all([
        registry.getOrCreate('a', factory),
        registry.getOrCreate('a', factory),
      ])

      expect(factory).toHaveBeenCalledTimes(1)
      expect(first).toBe(dataSource)
      expect(second).toBe(dataSource)

      // Both callers hold a reference - two releases should be needed to reach refCount 0.
      registry.release('a')
      expect(registry.getStats().entries[0].refCount).toBe(1)
      registry.release('a')
      expect(registry.getStats().entries[0].refCount).toBe(0)

      await registry.close()
    })

    it('clears the in-flight entry on failure so a later call retries', async () => {
      const registry = new DataSourceRegistry({ logger: console })

      const error = new Error('connection failed')
      const failingFactory = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        throw error
      })

      await expect(
        Promise.all([
          registry.getOrCreate('a', failingFactory),
          registry.getOrCreate('a', failingFactory),
        ])
      ).rejects.toThrow('connection failed')

      expect(failingFactory).toHaveBeenCalledTimes(1)
      expect(registry.has('a')).toBe(false)

      const dataSource = makeFakeDataSource(() => false)
      const succeedingFactory = jest.fn(async () => dataSource as any)
      const result = await registry.getOrCreate('a', succeedingFactory)

      expect(succeedingFactory).toHaveBeenCalledTimes(1)
      expect(result).toBe(dataSource)

      registry.release('a')
      await registry.close()
    })
  })
})
