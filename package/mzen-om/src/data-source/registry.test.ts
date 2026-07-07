import { DataSourceRegistry } from './registry'
import { DataSourceInterface } from './interface'

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
      const registry = new DataSourceRegistry({ maxSize: 1, logger: console })

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
  })
})
