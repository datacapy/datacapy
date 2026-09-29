# Migration System Architecture

## Overview

This document explains the technical implementation of the `@datacapy/migrate` database migration system. For usage instructions, see the [main README](../../README.md).

## Contents

- [System Components](./components.md) - MigrationManager, migration patches, and the migrationMeta tracking table
- [Execution Flow](./execution-flow.md) - The full migration sequence, version management, and datasource resolution
- [Runtime Safety](./runtime-safety.md) - Transaction safety, dry-run mode, performance considerations, error handling, and security

## Summary

The @datacapy/migrate system provides:

- ✅ **Controlled** database changes through versioned patches
- ✅ **Tracked** history in migrationMeta table
- ✅ **Safe** execution with transactions and automatic rollback
- ✅ **Flexible** support for static and dynamic datasources
- ✅ **Resumable** automatic resume from last successful patch
- ✅ **Auditable** clear history of all changes

## Related Documentation

- [Main README](../../README.md) - Usage instructions and examples
- [Best Practices](../best-practices/index.md) - Guidelines for writing migrations
- [Advanced Usage](../advanced-usage/index.md) - Advanced patterns and troubleshooting
