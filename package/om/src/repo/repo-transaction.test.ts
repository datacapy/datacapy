import { Repo } from './repo'
import { DataSourceContext } from 'data-source/context'
import { DataSourceInterface } from 'data-source/interface'

function makeLease(): jest.Mocked<
  Pick<DataSourceInterface, 'transactionCommit' | 'transactionRollback'>
> {
  return {
    transactionCommit: jest.fn().mockResolvedValue(undefined),
    transactionRollback: jest.fn().mockResolvedValue(undefined),
  }
}

describe('Repo#transaction', () => {
  const dataSourceName = 'workspace'

  function makeRepoAndDataSource(lease: any) {
    const dataSource = {
      isDynamic: () => true,
      transactionStart: jest.fn().mockResolvedValue(lease),
    }
    const repo = new Repo({ name: 'survey', dataSource: dataSourceName })
    repo.dataSource = dataSource as any
    jest.spyOn(repo, 'getDataSource').mockResolvedValue(dataSource as any)
    jest.spyOn(repo, 'releaseDataSource')
    return { repo, dataSource }
  }

  it('commits on success and returns fn()s result', async () => {
    const lease = makeLease()
    const { repo, dataSource } = makeRepoAndDataSource(lease)
    const context = new DataSourceContext()

    const result = await repo.transaction(context, async (txContext, tx) => {
      expect(tx).toBe(lease)
      // The lease must be bound onto the context handed to fn, for nested
      // repo.xxx({ context }) calls - without mutating the caller's own context.
      expect(txContext.getActiveDataSource(dataSourceName)).toBe(lease)
      expect(context.getActiveDataSource(dataSourceName)).toBeUndefined()
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(dataSource.transactionStart).toHaveBeenCalledTimes(1)
    expect(lease.transactionCommit).toHaveBeenCalledTimes(1)
    expect(lease.transactionRollback).not.toHaveBeenCalled()
  })

  it('rolls back and rethrows on error', async () => {
    const lease = makeLease()
    const { repo } = makeRepoAndDataSource(lease)
    const context = new DataSourceContext()
    const error = new Error('boom')

    await expect(
      repo.transaction(context, async () => {
        throw error
      })
    ).rejects.toThrow('boom')

    expect(lease.transactionRollback).toHaveBeenCalledTimes(1)
    expect(lease.transactionCommit).not.toHaveBeenCalled()
  })

  it('never mutates the caller-supplied context, and always releases the registry ref', async () => {
    const lease = makeLease()
    const { repo } = makeRepoAndDataSource(lease)
    const context = new DataSourceContext()

    await repo.transaction(context, async () => 'ok')
    expect(context.getActiveDataSource(dataSourceName)).toBeUndefined()
    expect(repo.releaseDataSource).toHaveBeenCalledWith(context)
    ;(repo.releaseDataSource as jest.Mock).mockClear()

    await expect(
      repo.transaction(context, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(context.getActiveDataSource(dataSourceName)).toBeUndefined()
    expect(repo.releaseDataSource).toHaveBeenCalledWith(context)
  })

  describe('deadlock retry', () => {
    const deadlock = () =>
      Object.assign(new Error('Deadlock found'), {
        errno: 1213,
        code: 'ER_LOCK_DEADLOCK',
      })

    it('re-runs fn on a deadlock and returns the later result', async () => {
      const lease = makeLease()
      const { repo, dataSource } = makeRepoAndDataSource(lease)
      repo.setLogger({
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
      } as any)
      let calls = 0

      const result = await repo.transaction(
        new DataSourceContext(),
        async () => {
          calls += 1
          if (calls < 3) throw deadlock()
          return 'ok'
        },
        { backoffMs: [0, 0] }
      )

      expect(result).toBe('ok')
      expect(calls).toBe(3)
      expect(dataSource.transactionStart).toHaveBeenCalledTimes(3)
      expect(lease.transactionRollback).toHaveBeenCalledTimes(2)
      expect(lease.transactionCommit).toHaveBeenCalledTimes(1)
    })

    it('retries lock wait timeouts (errno 1205)', async () => {
      const lease = makeLease()
      const { repo } = makeRepoAndDataSource(lease)
      repo.setLogger({
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
      } as any)
      let calls = 0
      await repo.transaction(
        new DataSourceContext(),
        async () => {
          calls += 1
          if (calls === 1) throw Object.assign(new Error('x'), { errno: 1205 })
        },
        { backoffMs: [0] }
      )
      expect(calls).toBe(2)
    })

    it('gives up after maxAttempts and rethrows the deadlock', async () => {
      const lease = makeLease()
      const { repo } = makeRepoAndDataSource(lease)
      repo.setLogger({
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
      } as any)
      const fn = jest.fn().mockRejectedValue(deadlock())

      await expect(
        repo.transaction(new DataSourceContext(), fn, {
          maxAttempts: 2,
          backoffMs: [0],
        })
      ).rejects.toMatchObject({ errno: 1213 })
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('does not retry other errors', async () => {
      const lease = makeLease()
      const { repo } = makeRepoAndDataSource(lease)
      const fn = jest.fn().mockRejectedValue(new Error('boom'))
      await expect(
        repo.transaction(new DataSourceContext(), fn)
      ).rejects.toThrow('boom')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('maxAttempts of 1 disables retry', async () => {
      const lease = makeLease()
      const { repo } = makeRepoAndDataSource(lease)
      const fn = jest.fn().mockRejectedValue(deadlock())
      await expect(
        repo.transaction(new DataSourceContext(), fn, { maxAttempts: 1 })
      ).rejects.toMatchObject({ errno: 1213 })
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
