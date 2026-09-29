/**
 * MigrationLogger
 *
 * Structured logging for migration operations with timestamps and log levels
 */
export class MigrationLogger {
  private verbose: boolean;
  private customLogger?: (
    message: string,
    level?: "info" | "warn" | "error",
  ) => void;

  constructor(
    verbose: boolean = false,
    customLogger?: (message: string, level?: "info" | "warn" | "error") => void,
  ) {
    this.verbose = verbose;
    this.customLogger = customLogger;
  }

  /**
   * Log info message
   */
  info(message: string): void {
    this.log(message, "info");
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    this.log(message, "warn");
  }

  /**
   * Log error message
   */
  error(message: string): void {
    this.log(message, "error");
  }

  /**
   * Log verbose message (only shown if verbose mode enabled)
   */
  verboseLog(message: string): void {
    if (this.verbose) {
      this.log(message, "info");
    }
  }

  /**
   * Log success message
   */
  success(message: string): void {
    this.log(message, "info");
  }

  /**
   * Core logging method
   */
  private log(message: string, level: "info" | "warn" | "error"): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (this.customLogger) {
      this.customLogger(formattedMessage, level);
    } else {
      // Use default console logging with appropriate method
      switch (level) {
        case "error":
          console.error(formattedMessage);
          break;
        case "warn":
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }

  /**
   * Log migration start
   */
  logMigrationStart(dataSourceName: string, patchCount: number): void {
    this.info(`Starting migration for datasource: ${dataSourceName}`);
    this.info(`Found ${patchCount} patches to apply`);
  }

  /**
   * Log migration complete
   */
  logMigrationComplete(
    successCount: number,
    failedCount: number,
    duration: number,
  ): void {
    this.success(
      `Migration complete: ${successCount} successful, ${failedCount} failed (${duration}ms)`,
    );
  }

  /**
   * Log patch execution start
   */
  logPatchStart(version: string, description: string): void {
    this.verboseLog(`Applying patch ${version}: ${description}`);
  }

  /**
   * Log patch execution success
   */
  logPatchSuccess(version: string, duration: number): void {
    this.verboseLog(`✓ Patch ${version} applied successfully (${duration}ms)`);
  }

  /**
   * Log patch execution failure
   */
  logPatchFailure(version: string, error: Error): void {
    this.error(`✗ Patch ${version} failed: ${error.message}`);
    if (this.verbose && error.stack) {
      this.error(error.stack);
    }
  }

  /**
   * Log patch skipped
   */
  logPatchSkipped(version: string, reason: string): void {
    this.verboseLog(`⊘ Patch ${version} skipped: ${reason}`);
  }

  /**
   * Log dry run mode
   */
  logDryRun(): void {
    this.warn("DRY RUN MODE - No changes will be applied");
  }

  /**
   * Log current database version
   */
  logCurrentVersion(version: string): void {
    this.info(`Current database version: ${version}`);
  }

  /**
   * Log target version
   */
  logTargetVersion(version: string): void {
    this.info(`Target version: ${version}`);
  }
}
