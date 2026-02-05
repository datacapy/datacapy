import * as path from "path";
import { CommandParser, CliArguments } from "./command-parser";
import { MigrationManager } from "../manager/migration-manager";
import { MigrationConfig } from "../interface/migration-config";

/**
 * CliRunner
 *
 * Executes CLI commands and handles application lifecycle
 */
export class CliRunner {
  /**
   * Run the CLI application
   *
   * @param args - Command-line arguments (process.argv.slice(2))
   * @returns Exit code (0 for success, 1 for error)
   */
  static async run(args: string[]): Promise<number> {
    try {
      // Parse arguments
      const cliArgs = CommandParser.parse(args);

      // Handle help
      if (cliArgs.help) {
        console.log(CommandParser.getHelpText());
        return 0;
      }

      // Handle version
      if (cliArgs.version) {
        const packageJson = require("../../package.json");
        console.log(`mzen-migrate v${packageJson.version}`);
        return 0;
      }

      // Validate arguments
      CommandParser.validate(cliArgs);

      // Load config file
      const config = await this.loadConfig(cliArgs);

      // Validate required config
      if (!config.modelManager) {
        throw new Error("Config file must provide a modelManager instance");
      }

      // Merge CLI arguments with config
      const migrationConfig: MigrationConfig = {
        ...config,
        modelManager: config.modelManager,
        dataSourceName: cliArgs.datasource!,
        context:
          Object.keys(cliArgs.context).length > 0
            ? cliArgs.context
            : config.context,
        patchDirectory: cliArgs.patchDirectory || config.patchDirectory,
        targetVersion: cliArgs.targetVersion || config.targetVersion,
        dryRun: cliArgs.dryRun || config.dryRun,
        verbose: cliArgs.verbose || config.verbose,
      };

      // Run migration
      const manager = new MigrationManager(migrationConfig);
      const result = await manager.migrate();

      // Print summary
      this.printSummary(result);

      // Return exit code based on results
      return result.failedCount > 0 ? 1 : 0;
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      return 1;
    }
  }

  /**
   * Load configuration file
   */
  private static async loadConfig(
    cliArgs: CliArguments,
  ): Promise<Partial<MigrationConfig>> {
    const configPath = path.resolve(cliArgs.config!);

    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(configPath)];

      const configModule = require(configPath);
      const configExport = configModule.default || configModule;

      // If config is a function, call it to get the config object
      if (typeof configExport === "function") {
        return await configExport();
      }

      return configExport;
    } catch (error) {
      throw new Error(
        `Failed to load config file "${configPath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Print migration summary
   */
  private static printSummary(result: any): void {
    console.log("\n" + "=".repeat(60));
    console.log("MIGRATION SUMMARY");
    console.log("=".repeat(60));

    if (result.dryRun) {
      console.log("Mode:             DRY RUN (no changes applied)");
    }

    console.log(`Previous version: ${result.previousVersion}`);
    console.log(`Current version:  ${result.currentVersion}`);
    console.log(`Total patches:    ${result.totalPatches}`);
    console.log(`Successful:       ${result.successCount}`);
    console.log(`Failed:           ${result.failedCount}`);
    console.log(`Skipped:          ${result.skippedCount}`);
    console.log(`Duration:         ${result.totalDuration}ms`);

    if (result.patchResults && result.patchResults.length > 0) {
      console.log("\nPATCH DETAILS:");
      for (const patch of result.patchResults) {
        const status =
          patch.status === "success"
            ? "✓"
            : patch.status === "failed"
              ? "✗"
              : "⊘";
        console.log(
          `  ${status} ${patch.version} - ${patch.description} (${patch.duration}ms)`,
        );

        if (patch.error) {
          console.log(`    Error: ${patch.error.message}`);
        }
      }
    }

    console.log("=".repeat(60) + "\n");

    if (result.failedCount > 0) {
      console.log("❌ Migration completed with errors");
    } else if (result.totalPatches === 0) {
      console.log("✓ Database is up to date");
    } else {
      console.log("✓ Migration completed successfully");
    }
  }
}
