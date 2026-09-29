/**
 * CommandParser
 *
 * Parses command-line arguments for the @datacapy/migrate CLI
 */

export interface CliArguments {
  config?: string; // -c, --config
  datasource?: string; // --datasource
  context: Record<string, string>; // --context (can be specified multiple times)
  contextLookup?: string; // --context-lookup (pattern for batch migrations)
  patchDirectory?: string; // -d, --patch-dir
  targetVersion?: string; // -t, --target
  dryRun: boolean; // --dry-run
  verbose: boolean; // -v, --verbose
  help: boolean; // -h, --help
  version: boolean; // --version
}

export class CommandParser {
  /**
   * Parse command-line arguments
   *
   * @param args - Process arguments (typically process.argv.slice(2))
   * @returns Parsed CLI arguments
   */
  static parse(args: string[]): CliArguments {
    const result: CliArguments = {
      context: {},
      dryRun: false,
      verbose: false,
      help: false,
      version: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "-c":
        case "--config":
          result.config = args[++i];
          break;

        case "--datasource":
          result.datasource = args[++i];
          break;

        case "--context": {
          const contextArg = args[++i];
          if (!contextArg) {
            throw new Error("--context requires a key=value argument");
          }

          const [key, value] = contextArg.split("=");
          if (!key || !value) {
            throw new Error(
              `Invalid context format: "${contextArg}". Expected format: key=value`,
            );
          }

          result.context[key] = value;
          break;
        }

        case "--context-lookup":
          result.contextLookup = args[++i];
          break;

        case "-d":
        case "--patch-dir":
          result.patchDirectory = args[++i];
          break;

        case "-t":
        case "--target":
          result.targetVersion = args[++i];
          break;

        case "--dry-run":
          result.dryRun = true;
          break;

        case "-v":
        case "--verbose":
          result.verbose = true;
          break;

        case "-h":
        case "--help":
          result.help = true;
          break;

        case "--version":
          result.version = true;
          break;

        default:
          throw new Error(`Unknown argument: ${arg}`);
      }
    }

    return result;
  }

  /**
   * Validate parsed arguments
   *
   * @param args - Parsed CLI arguments
   * @throws Error if validation fails
   */
  static validate(args: CliArguments): void {
    // If help or version requested, skip validation
    if (args.help || args.version) {
      return;
    }

    // Config file is required
    if (!args.config) {
      throw new Error("Missing required argument: --config");
    }

    // Datasource name is required
    if (!args.datasource) {
      throw new Error("Missing required argument: --datasource");
    }
  }

  /**
   * Get help text
   */
  static getHelpText(): string {
    return `
@datacapy/migrate - Database migration tool for @datacapy/om applications

USAGE:
  @datacapy/migrate [OPTIONS]

REQUIRED OPTIONS:
  -c, --config <file>        Path to migration config file
  --datasource <name>        Target datasource name (e.g., 'db', 'project')

OPTIONAL OPTIONS:
  --context <key=value>      Context for dynamic datasources (can be specified multiple times)
                             Example: --context projectId=abc123
  --context-lookup <pattern> Lookup pattern for batch migrations across multiple contexts
                             Example: --context-lookup "*" (migrate all projects)
                             Requires contextResolver to be configured
  -d, --patch-dir <dir>      Patch directory (default: ./migrate)
  -t, --target <version>     Target version to migrate to (default: latest)
                             Format: YYYY-MM-DD_HHMM
  --dry-run                  Preview migration without making changes
  -v, --verbose              Enable verbose logging
  -h, --help                 Show this help message
  --version                  Show package version

EXAMPLES:
  # Migrate account-level database
  @datacapy/migrate --config ./migrate.config.js --datasource db

  # Migrate specific project database
  @datacapy/migrate --config ./migrate.config.js --datasource project --context projectId=abc123

  # Migrate ALL project databases (batch migration)
  @datacapy/migrate --config ./migrate.config.js --datasource project --context-lookup "*"

  # Dry run to preview changes
  @datacapy/migrate --config ./migrate.config.js --datasource db --dry-run

  # Migrate to specific version
  @datacapy/migrate --config ./migrate.config.js --datasource db --target 2024-02-05_1430

  # Verbose output
  @datacapy/migrate --config ./migrate.config.js --datasource db --verbose

CONFIG FILE FORMAT:
  The config file should export an async function that returns a MigrationConfig object:

  // migrate.config.js
  const modelManager = require('./src/model-manager').default

  module.exports = async () => {
    return {
      modelManager,              // Existing ModelManager instance
      patchDirectory: './migrate'
      // dataSourceName and context provided via CLI arguments
    }
  }

PATCH FILE FORMAT:
  Patches must be placed in: <patchDir>/YYYY/MM/YYYY-MM-DD_HHMM_label.(ts|tsx|js)

  Example patch:
  // migrate/2024/02/2024-02-05_1430_add-users-table.ts
  import { DatabasePatchInterface } from '@datacapy/migrate'
  import { ModelManager } from '@datacapy/om'

  export default class AddUsersTable implements DatabasePatchInterface {
    version = '2024-02-05_1430'
    description = 'Add users table'
    dataSourceName = 'db'

    async update(modelManager: ModelManager): Promise<void> {
      const dataSource = modelManager.getDataSource('db')
      // Your migration logic here
    }
  }

For more information, visit: https://github.com/datacapy/datacapy
`;
  }
}
