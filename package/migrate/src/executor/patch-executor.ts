import { DatabasePatchInterface } from "../interface/database-patch";
import { PatchResult } from "../interface/migration-result";
import { ModelManager, DataSourceContext } from "@datacapy/om";
import { MigrationLogger } from "../logger/migration-logger";

/**
 * PatchExecutor
 *
 * Executes migration patches and records their outcome.
 *
 * Transaction safety is the patch's own responsibility: a patch that needs
 * atomicity across its repo calls must wrap them with `repo.transaction(context, fn)`
 * itself (see @datacapy/om's Repo#transaction). PatchExecutor cannot provide this
 * generically - transactionStart() returns a dedicated lease scoped to whichever
 * repo/datasource requested it, and repo calls that aren't explicitly handed that
 * lease's context bypass it entirely, so no datasource-level wrapping here would
 * actually cover a patch's writes.
 */
export class PatchExecutor {
  private modelManager: ModelManager;
  private logger: MigrationLogger;
  private dryRun: boolean;

  constructor(
    modelManager: ModelManager,
    logger: MigrationLogger,
    dryRun: boolean = false,
  ) {
    this.modelManager = modelManager;
    this.logger = logger;
    this.dryRun = dryRun;
  }

  /**
   * Execute a single patch
   *
   * @param patch - Patch to execute
   * @param context - DataSourceContext for dynamic datasource routing; also passed to the
   *                  patch so it can call `repo.transaction(context, fn)` for atomicity
   * @returns PatchResult with status, duration, and error details
   */
  async executePatch(
    patch: DatabasePatchInterface,
    context: DataSourceContext,
  ): Promise<PatchResult> {
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

    try {
      // Pass ModelManager to give patch access to all datasources, repos, and services;
      // pass context so the patch can wrap its own repo calls in a transaction via
      // repo.transaction(context, fn) where atomicity is required
      await patch.update(this.modelManager, context);

      result.status = "success";
      result.duration = Date.now() - startTime;

      this.logger.logPatchSuccess(patch.version, result.duration);
    } catch (error) {
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
   * @param context - DataSourceContext threaded through to each patch
   * @param stopOnError - Stop execution on first error (default: true)
   * @returns Array of patch results
   */
  async executePatches(
    patches: DatabasePatchInterface[],
    context: DataSourceContext,
    stopOnError: boolean = true,
  ): Promise<PatchResult[]> {
    const results: PatchResult[] = [];

    for (const patch of patches) {
      const result = await this.executePatch(patch, context);
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
