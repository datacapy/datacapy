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

    try {
      if (this.config.dryRun) {
        this.logger.logDryRun();
      }

      // Step 1: Resolve target datasource
      this.logger.verboseLog("Resolving target datasource...");
      const targetDataSource = await this.resolveDataSource();

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
    }
  }

  /**
   * Resolve target datasource based on configuration
   *
   * Handles both static and dynamic datasources
   */
  private async resolveDataSource(): Promise<DataSourceInterface> {
    const { modelManager, dataSourceName, context } = this.config;

    // Try static datasource lookup first
    try {
      const staticDataSource = modelManager.getDataSource(dataSourceName);
      if (staticDataSource) {
        this.logger.verboseLog(`Resolved static datasource: ${dataSourceName}`);
        return staticDataSource;
      }
    } catch (error) {
      // Not a static datasource, try dynamic lookup
    }

    // Try dynamic datasource lookup
    if (!context) {
      throw new Error(
        `Datasource "${dataSourceName}" not found. If this is a dynamic datasource, provide context via --context argument.`,
      );
    }

    // Convert context to DataSourceContext if it's a plain object
    let dsContext: DataSourceContext;
    if (context instanceof DataSourceContext) {
      dsContext = context;
    } else {
      // Convert Record<string, string> to DataSourceContext
      // Assume the dataSourceName maps to a lookupKey
      const contextEntry = Object.keys(context).reduce((acc, key) => {
        acc[dataSourceName] = { lookupKey: context[key] };
        return acc;
      }, {} as any);

      dsContext = DataSourceContext.fromDataSources(contextEntry);
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

      return dynamicDataSource;
    } catch (error) {
      throw new Error(
        `Failed to resolve datasource "${dataSourceName}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
