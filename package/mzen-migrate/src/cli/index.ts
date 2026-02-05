#!/usr/bin/env node

import { CliRunner } from "./runner";

/**
 * CLI Entry Point
 *
 * This is the main entry point for the mzen-migrate CLI tool.
 * It parses arguments and executes the migration.
 */
async function main() {
  const args = process.argv.slice(2);
  const exitCode = await CliRunner.run(args);
  process.exit(exitCode);
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
