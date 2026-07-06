import {
  MigrationConfig,
  MigrationConfigResolved,
} from "../interface/migration-config";
import { MigrationResult, PatchResult } from "../interface/migration-result";
import { VersionManager } from "../version/version-manager";
import { MetaTable } from "../meta/meta-table";
import { PatchScanner } from "../scanner/patch-scanner";
import { PatchExecutor } from "../executor/patch-executor";
import { MigrationLogger } from "../logger/migration-logger";
import {
  DataSourceInterface,
  DataSourceContext,
} from "mzen-om/dist/data-source";

/**
 * MigrationManager
 *
 * Main orchestrator for database migrations.
 * Coordinates datasource resolution, patch discovery, execution, and tracking.
 */
export class MigrationManager {
  private config: MigrationConfigResolved;
  private logger: MigrationLogger;

  constructor(config: MigrationConfig) {
    // Resolve config with defaults
    this.config = {
      ...config,
      patchDirectory: config.patchDirectory || "./migrate",
      targetVersion: config.targetVersion || "latest",
      metaTableName: config.metaTableName || "migrationMeta",
      dryRun: config.dryRun || false,
      verbose: config.verbose || false,
      stopOnError: config.stopOnError !== undefined ? config.stopOnError : true,
    };

    this.logger = new MigrationLogger(this.config.verbose, this.config.logger);
  }

  /**
   * Execute migration
   *
   * Main entry point for running migrations
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = new Date();
    let releaseKey: string | undefined;

    try {
      // Check if this is a batch migration (contextLookup provided)
      if (this.config.contextLookup) {
        return await this.migrateBatch(startTime);
      }

      if (this.config.dryRun) {
        this.logger.logDryRun();
      }

      // Step 1: Resolve target datasource
      this.logger.verboseLog("Resolving target datasource...");
      const resolved = await this.resolveDataSource();
      const targetDataSource = resolved.dataSource;
      releaseKey = resolved.releaseKey;

      // Initialize dynamic repos so patches can call repo methods directly
      const dsContext = this.buildDataSourceContext();
      if (dsContext) {
        await this.config.modelManager.initDynamicReposForDataSource(
          this.config.dataSourceName,
          dsContext,
        );
      }

      // Step 2: Initialize meta table
      this.logger.verboseLog("Initializing meta table...");
      const metaTable = new MetaTable(
        targetDataSource,
        this.config.metaTableName,
      );
      await metaTable.initialize();

      // Step 3: Get current database version
      const currentVersion = await metaTable.getCurrentVersion();
      this.logger.logCurrentVersion(currentVersion);

      // Step 4: Scan for patches
      this.logger.verboseLog(
        `Scanning patches in ${this.config.patchDirectory}...`,
      );
      const scanner = new PatchScanner(this.config.patchDirectory);
      const allPatchFiles = await scanner.scanPatches();

      // Step 5: Filter patches by datasource name
      const filteredPatchFiles = allPatchFiles.filter(
        (pf) => pf.patch.dataSourceName === this.config.dataSourceName,
      );

      this.logger.verboseLog(
        `Found ${allPatchFiles.length} total patches, ${filteredPatchFiles.length} for datasource "${this.config.dataSourceName}"`,
      );

      // Step 6: Determine patches to apply
      const allVersions = filteredPatchFiles.map((pf) => pf.version);
      const targetVersion =
        this.config.targetVersion === "latest"
          ? VersionManager.getLatestVersion(allVersions)
          : this.config.targetVersion;

      if (targetVersion) {
        this.logger.logTargetVersion(targetVersion);
      }

      const versionsToApply = VersionManager.getVersionsToApply(
        allVersions,
        currentVersion,
        targetVersion,
      );

      const patchesToApply = filteredPatchFiles
        .filter((pf) => versionsToApply.includes(pf.version))
        .map((pf) => pf.patch);

      if (patchesToApply.length === 0) {
        this.logger.info("No patches to apply. Database is up to date.");

        return {
          totalPatches: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          patchResults: [],
          previousVersion: currentVersion,
          currentVersion: currentVersion,
          totalDuration: Date.now() - startTime.getTime(),
          dryRun: this.config.dryRun,
          startTime,
          endTime: new Date(),
        };
      }

      this.logger.logMigrationStart(
        this.config.dataSourceName,
        patchesToApply.length,
      );

      // Step 7: Execute patches
      const executor = new PatchExecutor(
        this.config.modelManager,
        targetDataSource,
        this.logger,
        this.config.dryRun,
      );

      const patchResults = await executor.executePatches(
        patchesToApply,
        this.config.stopOnError,
      );

      // Step 8: Record successful patches in meta table
      if (!this.config.dryRun) {
        for (const result of patchResults) {
          if (result.status === "success") {
            await metaTable.recordPatch(
              result.version,
              result.description,
              result.duration,
            );
          }
        }
      }

      // Step 9: Get new current version
      const newCurrentVersion = this.config.dryRun
        ? currentVersion
        : await metaTable.getCurrentVersion();

      // Step 10: Generate summary
      const successCount = patchResults.filter(
        (r) => r.status === "success",
      ).length;
      const failedCount = patchResults.filter(
        (r) => r.status === "failed",
      ).length;
      const skippedCount = patchResults.filter(
        (r) => r.status === "skipped",
      ).length;

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      this.logger.logMigrationComplete(
        successCount,
        failedCount,
        totalDuration,
      );

      return {
        totalPatches: patchResults.length,
        successCount,
        failedCount,
        skippedCount,
        patchResults,
        previousVersion: currentVersion,
        currentVersion: newCurrentVersion,
        totalDuration,
        dryRun: this.config.dryRun,
        startTime,
        endTime,
      };
    } catch (error) {
      const endTime = new Date();
      this.logger.error(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    } finally {
      if (releaseKey) {
        this.config.modelManager.dataSourceRegistry?.release(releaseKey);
      }
    }
  }

  /**
   * Execute batch migration across multiple contexts
   *
   * Resolves a context lookup pattern into multiple contexts,
   * then runs migrations sequentially for each context.
   * Stops on first failure (fail-fast).
   */
  private async migrateBatch(startTime: Date): Promise<MigrationResult> {
    const { contextLookup, contextResolver } = this.config;

    if (!contextResolver) {
      throw new Error(
        "contextResolver is required when contextLookup is provided",
      );
    }

    if (!contextLookup) {
      throw new Error("contextLookup pattern is required for batch migration");
    }

    this.logger.info(`Resolving context pattern: ${contextLookup}`);

    // Resolve pattern into list of contexts
    let contexts: Array<Record<string, string>>;
    try {
      contexts = await contextResolver.resolve(contextLookup);
    } catch (error) {
      throw new Error(
        `Failed to resolve context pattern "${contextLookup}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (contexts.length === 0) {
      this.logger.info(`No contexts found for pattern "${contextLookup}"`);
      return {
        totalPatches: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        patchResults: [],
        previousVersion: null,
        currentVersion: null,
        totalDuration: Date.now() - startTime.getTime(),
        dryRun: this.config.dryRun,
        startTime,
        endTime: new Date(),
      };
    }

    this.logger.info(
      `Found ${contexts.length} context(s) to migrate sequentially`,
    );

    if (this.config.dryRun) {
      this.logger.logDryRun();
    }

    // Track aggregate results
    const allPatchResults: PatchResult[] = [];
    let totalSuccessCount = 0;
    let totalFailedCount = 0;
    let totalSkippedCount = 0;

    // Migrate each context sequentially
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      const contextStr = JSON.stringify(context);

      this.logger.info(
        `\n[${i + 1}/${contexts.length}] Migrating context: ${contextStr}`,
      );

      try {
        // Create a new migration manager with this specific context
        const contextConfig: MigrationConfig = {
          ...this.config,
          context,
          contextLookup: undefined, // Don't recurse
          contextResolver: undefined,
        };

        const contextManager = new MigrationManager(contextConfig);
        const result = await contextManager.migrate();

        // Aggregate results
        allPatchResults.push(...result.patchResults);
        totalSuccessCount += result.successCount;
        totalFailedCount += result.failedCount;
        totalSkippedCount += result.skippedCount;

        // Stop on failure (fail-fast)
        if (result.failedCount > 0) {
          this.logger.error(
            `Migration failed for context ${contextStr}. Stopping batch migration.`,
          );
          break;
        }

        this.logger.info(
          `✓ Context ${contextStr} migrated successfully (${result.successCount} patches applied)`,
        );
      } catch (error) {
        this.logger.error(
          `Migration failed for context ${contextStr}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Stop on first error (fail-fast)
        throw error;
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    this.logger.info("\n=== Batch Migration Summary ===");
    this.logger.info(`Total contexts migrated: ${contexts.length}`);
    this.logger.info(`Total patches applied: ${totalSuccessCount}`);
    this.logger.info(`Total patches failed: ${totalFailedCount}`);
    this.logger.info(`Total patches skipped: ${totalSkippedCount}`);
    this.logger.info(`Total duration: ${totalDuration}ms`);

    return {
      totalPatches: allPatchResults.length,
      successCount: totalSuccessCount,
      failedCount: totalFailedCount,
      skippedCount: totalSkippedCount,
      patchResults: allPatchResults,
      previousVersion: null, // Not meaningful in batch context
      currentVersion: null, // Not meaningful in batch context
      totalDuration,
      dryRun: this.config.dryRun,
      startTime,
      endTime,
    };
  }

  /**
   * Build a DataSourceContext from config.context, normalising plain objects
   * into the DataSourceContext format. Returns undefined if no context configured.
   */
  private buildDataSourceContext(): DataSourceContext | undefined {
    const { context, dataSourceName } = this.config;
    if (!context) return undefined;
    if (context instanceof DataSourceContext) return context;

    const entry = Object.keys(context as Record<string, string>).reduce(
      (acc, key) => {
        acc[dataSourceName] = {
          lookupKey: (context as Record<string, string>)[key],
        };
        return acc;
      },
      {} as any,
    );
    return DataSourceContext.fromDataSources(entry);
  }

  /**
   * Resolve target datasource based on configuration
   *
   * Handles both static and dynamic datasources
   */
  private async resolveDataSource(): Promise<{
    dataSource: DataSourceInterface;
    releaseKey?: string;
  }> {
    const { modelManager, dataSourceName } = this.config;

    // Try static datasource lookup first
    try {
      const staticDataSource = modelManager.getDataSource(dataSourceName);
      const isDynamic =
        staticDataSource &&
        typeof (staticDataSource as any).isDynamic === "function" &&
        (staticDataSource as any).isDynamic();
      if (staticDataSource && !isDynamic) {
        this.logger.verboseLog(`Resolved static datasource: ${dataSourceName}`);
        return { dataSource: staticDataSource };
      }
    } catch (error) {
      // Not a static datasource, try dynamic lookup
    }

    // Try dynamic datasource lookup
    const dsContext = this.buildDataSourceContext();
    if (!dsContext) {
      throw new Error(
        `Datasource "${dataSourceName}" not found. If this is a dynamic datasource, provide context via --context argument.`,
      );
    }

    const contextEntry = dsContext.getForDataSource(dataSourceName);
    if (!contextEntry) {
      throw new Error(
        `No context provided for dynamic datasource "${dataSourceName}"`,
      );
    }

    try {
      const dynamicDataSource = await modelManager.getDataSourceDynamic(
        dataSourceName,
        contextEntry,
      );

      this.logger.verboseLog(
        `Resolved dynamic datasource: ${dataSourceName} (lookupKey: ${contextEntry.lookupKey})`,
      );

      const releaseKey = contextEntry.lookupKey
        ? `${dataSourceName}:${contextEntry.lookupKey}`
        : undefined;

      return { dataSource: dynamicDataSource, releaseKey };
    } catch (error) {
      throw new Error(
        `Failed to resolve datasource "${dataSourceName}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
