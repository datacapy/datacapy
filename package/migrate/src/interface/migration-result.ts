/**
 * PatchResult
 *
 * Result of executing a single migration patch
 */
export interface PatchResult {
  /**
   * Patch version
   */
  version: string;

  /**
   * Patch description
   */
  description: string;

  /**
   * Target datasource name
   */
  dataSourceName: string;

  /**
   * Execution status
   */
  status: "success" | "failed" | "skipped";

  /**
   * Execution duration in milliseconds
   */
  duration: number;

  /**
   * Error details if failed
   */
  error?: {
    message: string;
    stack?: string;
  };

  /**
   * Timestamp when patch was executed
   */
  timestamp: Date;
}

/**
 * MigrationResult
 *
 * Overall result of migration execution
 */
export interface MigrationResult {
  /**
   * Total number of patches processed
   */
  totalPatches: number;

  /**
   * Number of successful patches
   */
  successCount: number;

  /**
   * Number of failed patches
   */
  failedCount: number;

  /**
   * Number of skipped patches
   */
  skippedCount: number;

  /**
   * Individual patch results
   */
  patchResults: PatchResult[];

  /**
   * Current database version before migration
   */
  previousVersion: string;

  /**
   * Database version after migration
   */
  currentVersion: string;

  /**
   * Total execution duration in milliseconds
   */
  totalDuration: number;

  /**
   * Whether this was a dry run
   */
  dryRun: boolean;

  /**
   * Timestamp when migration started
   */
  startTime: Date;

  /**
   * Timestamp when migration completed
   */
  endTime: Date;
}

/**
 * PatchFile
 *
 * Represents a discovered patch file on disk
 */
export interface PatchFile {
  /**
   * Patch version
   */
  version: string;

  /**
   * Full file path
   */
  filePath: string;

  /**
   * Loaded patch class instance
   */
  patch: any;
}
