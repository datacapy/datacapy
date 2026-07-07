import { DataSourceContext } from 'data-source/context'
import { Repo } from './repo'

/**
 * Runs `fn` inside a transaction on `repo`'s datasource, handling the full
 * acquire/lease/release/commit/rollback sequence in one place so no call site has to hand-roll
 * it:
 *
 * 1. Acquires the initial registry ref via repo.getDataSource(context).
 * 2. Calls transactionStart() on it to obtain an exclusive lease, and binds that lease onto
 *    `context` via setActiveDataSource() so every nested repo.xxx({ context }) call inside `fn`
 *    resolves the same lease (see Repo#getDataSource()).
 * 3. Runs fn(lease).
 * 4. Commits on success; rolls back and rethrows on error.
 * 5. Always clears the active-datasource slot on `context` and releases the initial registry ref,
 *    in a finally block - regardless of whether fn/commit/rollback threw.
 */
export async function withTransaction<T>(
  repo: Repo<any>,
  context: DataSourceContext,
  dataSourceName: string,
  fn: (tx: import('data-source/interface').DataSourceInterface) => Promise<T>
): Promise<T> {
  const dataSource = await repo.getDataSource(context)

  try {
    const lease = await dataSource.transactionStart()
    context.setActiveDataSource(dataSourceName, lease)

    try {
      const result = await fn(lease)
      await lease.transactionCommit()
      return result
    } catch (error) {
      await lease.transactionRollback()
      throw error
    }
  } finally {
    context.clearActiveDataSource(dataSourceName)
    repo.releaseDataSource(context)
  }
}

export default withTransaction
