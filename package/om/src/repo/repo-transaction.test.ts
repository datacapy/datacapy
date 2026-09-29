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
  const dataSourceName = 'project'

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
})
