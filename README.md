# Mzen Monorepo

A TypeScript-based ODM/ORM framework with schema validation, REST API
generation, and utilities for building data-driven applications.

## Packages

The packages layer from the bottom up: `mzen-id` generates IDs, `mzen-schema`
defines and validates data, `mzen-om` persists it, `mzen-migrate` evolves the
database, and `mzen-server` exposes it over HTTP. Each package has its own
README with the full API; the guides are linked below.

### mzen-id

Utility for generating short, time-ordered Base62 string IDs (12 bytes, 15
characters), designed as a relational database-friendly alternative to MongoDB's
ObjectId format. Used by `mzen-schema` to default `_id` fields.

See the [`mzen-id` README](package/mzen-id/README.md).

### mzen-schema

Schema validation, formatting, and filtering library. Provides:

- Fluent schema builder (`sb`) and raw spec definitions
- Type-safe schema definitions
- Data validation and type casting
- Field filtering and sanitization
- Constructor initialization
- Query validation

Used by `mzen-om` for repository validation and by `mzen-server` for request
validation.

See the [`mzen-schema` README](package/mzen-schema/README.md), or go straight to
a guide:

- [Builder](package/mzen-schema/docs/builder.md): every builder and method, and the equivalent plain spec
- [Validation](package/mzen-schema/docs/validation.md): rules, error messages, strict mode, casting, query validation
- [Filtering](package/mzen-schema/docs/filtering.md): defaults, string filters, conditional and custom filters, private fields
- [Encryption](package/mzen-schema/docs/encryption.md): marking fields and the encryption service interface
- [Composition](package/mzen-schema/docs/composition.md): schema references, arrays, `$or`, dynamic keys, constructors

### mzen-om

Object mapper providing ODM/ORM functionality for TypeScript applications.
Supports multiple data sources including MongoDB and MySQL, with features like:

- Model management and repositories
- Relationship handling (has-one, has-many, belongs-to)
- Query building and population
- Field-level at-rest encryption
- Service layer abstraction

See the [`mzen-om` README](package/mzen-om/README.md), or go straight to a
guide:

- [Architecture](package/mzen-om/docs/architecture.md): system design and components
- [Relations](package/mzen-om/docs/relations.md) and [Composite Keys](package/mzen-om/docs/composite-keys.md)
- [Validation](package/mzen-om/docs/validation.md): data validation and type-casting
- [Encryption](package/mzen-om/docs/encryption.md): field-level at-rest encryption
- [DataSource Context](package/mzen-om/docs/dynamic-datasource.md), with [advanced](package/mzen-om/docs/dynamic-datasource-advanced.md) and [multiple](package/mzen-om/docs/dynamic-datasource-multiple.md) usage
- [MySQL Indexes](package/mzen-om/docs/mysql-indexes.md) and [Update Operators](package/mzen-om/docs/update-operators.md) (MySQL)
- [Upsert Operations](package/mzen-om/docs/upsert.md)
- [Performance](package/mzen-om/docs/performance.md), [Testing](package/mzen-om/docs/testing.md) and [Debugging](package/mzen-om/docs/debugging.md)

### mzen-migrate

Database migration runner for mzen data sources, with versioned patches, dry-run
mode and multi-datasource support.

See the [`mzen-migrate` README](package/mzen-migrate/README.md), or go straight
to a guide:

- [Architecture](package/mzen-migrate/docs/architecture/index.md): components, execution flow, runtime safety
- [Best Practices](package/mzen-migrate/docs/best-practices/index.md): dos and don'ts, testing and rollback, common patterns
- [Advanced Usage](package/mzen-migrate/docs/advanced-usage/index.md): multi-datasource migrations, custom workflows, troubleshooting

### mzen-server

REST API server framework for exposing models as HTTP endpoints. Features:

- Automatic API generation from models
- Built-in ACL and role-based access control
- Express.js integration
- Configurable endpoints and middleware

See the [`mzen-server` README](package/mzen-server/README.md) for endpoint
configuration, ACL rules and server options, and
[`example1.js`](package/mzen-server/examples/example1.js) for a runnable setup.

## Installation

This is a pnpm monorepo. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Development

```bash
# Build specific package
pnpm build:mzen-om
pnpm build:mzen-schema
pnpm build:mzen-server
pnpm build:mzen-id

# Test specific package
pnpm test:mzen-om
pnpm test:mzen-schema
pnpm test:mzen-server
pnpm test:mzen-id

# Build or test mzen-migrate (no root shortcut)
pnpm --filter mzen-migrate build
pnpm --filter mzen-migrate test

# Clean build outputs
pnpm clean

# Format code
pnpm format
```

## License

[BSD 3-Clause](LICENSE)
