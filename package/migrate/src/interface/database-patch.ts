import { ModelManager, DataSourceContext } from "@datacapy/om";

/**
 * DatabasePatchInterface
 *
 * Interface that all migration patches must implement.
 * Each patch represents a database schema or data change with a unique timestamp version.
 */
export interface DatabasePatchInterface {
  /**
   * Version timestamp in format: YYYY-MM-DD_HHMM
   * Example: "2024-02-05_1430"
   */
  version: string;

  /**
   * Human-readable description of what this patch does
   * Example: "Add indexes to users table for performance"
   */
  description: string;

  /**
   * Target datasource name that this patch operates on
   * Examples: 'db', 'workspace'
   * Only patches matching the CLI --datasource argument will be executed
   */
  dataSourceName: string;

  /**
   * Execute the migration patch
   *
   * @param modelManager - ModelManager instance providing access to datasources, repos, and services
   * @param context - DataSourceContext for the target datasource. Pass this to
   *   `repo.transaction(context, fn)` if the patch needs its repo calls wrapped
   *   in a transaction - PatchExecutor does not provide transaction protection itself.
   * @throws Error if patch execution fails
   */
  update(modelManager: ModelManager, context: DataSourceContext): Promise<void>;
}
