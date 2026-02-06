/**
 * mzen-migrate
 *
 * Database migration tool for mzen-om applications
 */

// Main API exports
export { MigrationManager } from "./manager/migration-manager";
export { VersionManager } from "./version/version-manager";
export { MetaTable, MetaRecord } from "./meta/meta-table";
export { PatchScanner } from "./scanner/patch-scanner";
export { PatchExecutor } from "./executor/patch-executor";
export { MigrationLogger } from "./logger/migration-logger";

// Interface exports
export { DatabasePatchInterface } from "./interface/database-patch";
export { ContextResolver } from "./interface/context-resolver";

export {
  MigrationConfig,
  MigrationConfigResolved,
} from "./interface/migration-config";

export {
  MigrationResult,
  PatchResult,
  PatchFile,
} from "./interface/migration-result";

// CLI exports (for programmatic use)
export { CommandParser, CliArguments } from "./cli/command-parser";
export { CliRunner } from "./cli/runner";
