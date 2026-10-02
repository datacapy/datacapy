import { ModelManager } from "@datacapy/om";
import { DataSourceContext } from "@datacapy/om/dist/data-source";
import { ContextResolver } from "./context-resolver";

/**
 * MigrationConfig
 *
 * Configuration for running database migrations
 */
export interface MigrationConfig {
  // ModelManager (required)
  /**
   * Existing ModelManager instance with configured datasources
   */
  modelManager: ModelManager;

  // Target datasource (required)
  /**
   * Name of the datasource to migrate
   * Examples: 'db', 'workspace'
   * Only patches with matching dataSourceName will be executed
   */
  dataSourceName: string;

  // Context for dynamic datasources (optional)
  /**
   * Context for resolving dynamic datasources
   * Required for dynamic datasources like 'workspace'
   * Example: { workspace: { lookupKey: 'abc123' } }
   * Can also be a simple key-value map: { workspaceId: 'abc123' }
   */
  context?: DataSourceContext | Record<string, string>;

  // Context lookup for batch migrations (optional)
  /**
   * Context lookup pattern for batch migrations across multiple contexts
   * Example: "*" for all workspaces, "ownerId=xyz" for filtered
   * Requires contextResolver to be provided
   */
  contextLookup?: string;

  /**
   * Context resolver for expanding lookup patterns into context values
   * Required when contextLookup is provided
   * Example: ContextResolverWorkspace to resolve "*" into all workspace IDs
   */
  contextResolver?: ContextResolver;

  // Migration Configuration
  /**
   * Directory containing migration patches
   * Default: './migrate'
   * Expected structure: patchDir/YYYY/MM/YYYY-MM-DD_HHMM_label.ts
   */
  patchDirectory?: string;

  /**
   * Target version to migrate to (format: YYYY-MM-DD_HHMM)
   * Default: latest version (all patches applied)
   */
  targetVersion?: string;

  /**
   * Name of the meta table for tracking applied migrations
   * Default: 'migrationMeta'
   * Stored in the resolved target datasource
   */
  metaTableName?: string;

  // Execution Options
  /**
   * Dry run mode - validate patches without applying changes
   * Default: false
   */
  dryRun?: boolean;

  /**
   * Verbose logging - log detailed execution information
   * Default: false
   */
  verbose?: boolean;

  /**
   * Stop on first error
   * Default: true
   */
  stopOnError?: boolean;

  // Custom Logging
  /**
   * Custom logger function
   * Default: console.log with timestamp
   */
  logger?: (message: string, level?: "info" | "warn" | "error") => void;
}

/**
 * MigrationConfigResolved
 *
 * Internal config with resolved defaults
 */
export interface MigrationConfigResolved extends MigrationConfig {
  patchDirectory: string;
  targetVersion: string;
  metaTableName: string;
  dryRun: boolean;
  verbose: boolean;
  stopOnError: boolean;
}
