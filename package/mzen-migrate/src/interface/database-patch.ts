import { ModelManager } from "mzen-om";

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
   * Examples: 'db', 'project', 'tenant'
   * Only patches matching the CLI --datasource argument will be executed
   */
  dataSourceName: string;

  /**
   * Execute the migration patch
   *
   * @param modelManager - ModelManager instance providing access to datasources, repos, and services
   * @throws Error if patch execution fails (will trigger transaction rollback)
   */
  update(modelManager: ModelManager): Promise<void>;
}
