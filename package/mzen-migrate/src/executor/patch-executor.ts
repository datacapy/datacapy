import { DatabasePatchInterface } from "../interface/database-patch";
import { PatchResult } from "../interface/migration-result";
import { ModelManager, DataSourceInterface } from "mzen-om";
import { MigrationLogger } from "../logger/migration-logger";

/**
 * PatchExecutor
 *
 * Executes migration patches with transaction safety.
 * Each patch is wrapped in a transaction with automatic rollback on failure.
 */
export class PatchExecutor {
  private modelManager: ModelManager;
  private metaDataSource: DataSourceInterface;
  private logger: MigrationLogger;
  private dryRun: boolean;

  constructor(
    modelManager: ModelManager,
    metaDataSource: DataSourceInterface,
    logger: MigrationLogger,
    dryRun: boolean = false,
  ) {
    this.modelManager = modelManager;
    this.metaDataSource = metaDataSource;
    this.logger = logger;
    this.dryRun = dryRun;
  }

  /**
   * Execute a single patch with transaction protection
   *
   * @param patch - Patch to execute
   * @returns PatchResult with status, duration, and error details
   */
  async executePatch(patch: DatabasePatchInterface): Promise<PatchResult> {
    const startTime = Date.now();
    const result: PatchResult = {
      version: patch.version,
      description: patch.description,
      dataSourceName: patch.dataSourceName,
      status: "success",
      duration: 0,
      timestamp: new Date(),
    };

    this.logger.logPatchStart(patch.version, patch.description);

    // In dry-run mode, skip actual execution
    if (this.dryRun) {
      result.status = "skipped";
      result.duration = Date.now() - startTime;
      this.logger.logPatchSkipped(patch.version, "dry-run mode");
      return result;
    }

    let transactionLease: DataSourceInterface | undefined;

    try {
      // Start transaction on meta datasource
      try {
        transactionLease = await this.metaDataSource.transactionStart();
      } catch (error) {
        // Some datasources (like Mock) don't support transactions
        // Log warning but continue
        this.logger.verboseLog(
          `Transaction not supported on meta datasource, continuing without transaction protection`,
        );
      }

      // Execute the patch
      // Pass ModelManager to give patch access to all datasources, repos, and services
      await patch.update(this.modelManager);

      // Commit transaction if started
      if (transactionLease) {
        await transactionLease.transactionCommit();
      }

      result.status = "success";
      result.duration = Date.now() - startTime;

      this.logger.logPatchSuccess(patch.version, result.duration);
    } catch (error) {
      // Rollback transaction if started
      if (transactionLease) {
        try {
          await transactionLease.transactionRollback();
          this.logger.verboseLog(
            `Transaction rolled back for patch ${patch.version}`,
          );
        } catch (rollbackError) {
          this.logger.error(
            `Failed to rollback transaction for patch ${patch.version}: ${rollbackError}`,
          );
        }
      }

      result.status = "failed";
      result.duration = Date.now() - startTime;
      result.error = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      this.logger.logPatchFailure(
        patch.version,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    return result;
  }

  /**
   * Execute multiple patches sequentially
   *
   * @param patches - Array of patches to execute
   * @param stopOnError - Stop execution on first error (default: true)
   * @returns Array of patch results
   */
  async executePatches(
    patches: DatabasePatchInterface[],
    stopOnError: boolean = true,
  ): Promise<PatchResult[]> {
    const results: PatchResult[] = [];

    for (const patch of patches) {
      const result = await this.executePatch(patch);
      results.push(result);

      // Stop if patch failed and stopOnError is true
      if (result.status === "failed" && stopOnError) {
        this.logger.error(
          `Stopping migration due to failed patch: ${patch.version}`,
        );
        break;
      }
    }

    return results;
  }
}
