# Migration Best Practices

## Overview

This document provides guidelines for writing effective, safe, and maintainable database migrations using mzen-migrate.

## Contents

- [Golden Rules: DO](./dos.md) - Dry-run first, idempotency, naming, logging, error handling, versioning, atomic patches, version control
- [Golden Rules: DON'T](./donts.md) - Common mistakes to avoid, including large-dataset pitfalls
- [Testing and Rollback](./testing-and-rollback.md) - Unit/integration testing, rollback strategy, and the production checklist
- [Common Patterns](./common-patterns.md) - Worked examples: index creation, data seeding, field addition, data transformation

## Summary

Follow these best practices to create safe, maintainable migrations:

1. ✅ Always dry-run first
2. ✅ Make migrations idempotent
3. ✅ Use descriptive names
4. ✅ Log progress clearly
5. ✅ Handle errors gracefully
6. ✅ Version chronologically
7. ✅ Keep patches atomic
8. ✅ Commit to version control
9. ❌ Don't modify existing migrations
10. ❌ Don't hardcode sensitive data

For more information, see:

- [Architecture Documentation](../architecture/index.md)
- [Advanced Usage](../advanced-usage/index.md)
- [Main README](../../README.md)
