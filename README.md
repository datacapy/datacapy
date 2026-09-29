# Datacapy Monorepo

A TypeScript-based ODM/ORM framework with schema validation, REST API
generation, and utilities for building data-driven applications.

## Packages

The packages layer from the bottom up: `@datacapy/id` generates IDs, `@datacapy/schema`
defines and validates data, `@datacapy/om` persists it, `@datacapy/migrate` evolves the
database, and `@datacapy/server` exposes it over HTTP. Each package has its own
README with the full API; the guides are linked below.

### @datacapy/id

Utility for generating short, time-ordered Base62 string IDs (12 bytes, 15
characters), designed as a relational database-friendly alternative to MongoDB's
ObjectId format. Used by `@datacapy/schema` to default `_id` fields.

See the [`@datacapy/id` README](package/id/README.md).

### @datacapy/schema

Schema validation, formatting, and filtering library. Provides:

- Fluent schema builder (`sb`) and raw spec definitions
- Type-safe schema definitions
- Data validation and type casting
- Field filtering and sanitization
- Constructor initialization
- Query validation

Used by `@datacapy/om` for repository validation and by `@datacapy/server` for request
validation.

See the [`@datacapy/schema` README](package/schema/README.md), or go straight to
a guide:

- [Builder](package/schema/docs/builder.md): every builder and method, and the equivalent plain spec
- [Validation](package/schema/docs/validation.md): rules, error messages, strict mode, casting, query validation
- [Filtering](package/schema/docs/filtering.md): defaults, string filters, conditional and custom filters, private fields
- [Encryption](package/schema/docs/encryption.md): marking fields and the encryption service interface
- [Composition](package/schema/docs/composition.md): schema references, arrays, `$or`, dynamic keys, constructors

### @datacapy/om

Object mapper providing ODM/ORM functionality for TypeScript applications.
Supports multiple data sources including MongoDB and MySQL, with features like:

- Model management and repositories
- Relationship handling (has-one, has-many, belongs-to)
- Query building and population
- Field-level at-rest encryption
- Service layer abstraction

See the [`@datacapy/om` README](package/om/README.md), or go straight to a
guide:

- [Architecture](package/om/docs/architecture.md): system design and components
- [Relations](package/om/docs/relations.md) and [Composite Keys](package/om/docs/composite-keys.md)
- [Validation](package/om/docs/validation.md): data validation and type-casting
- [Encryption](package/om/docs/encryption.md): field-level at-rest encryption
- [DataSource Context](package/om/docs/dynamic-datasource.md), with [advanced](package/om/docs/dynamic-datasource-advanced.md) and [multiple](package/om/docs/dynamic-datasource-multiple.md) usage
- [MySQL Indexes](package/om/docs/mysql-indexes.md) and [Update Operators](package/om/docs/update-operators.md) (MySQL)
- [Upsert Operations](package/om/docs/upsert.md)
- [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md) and [Debugging](package/om/docs/debugging.md)

### @datacapy/migrate

Database migration runner for Datacapy data sources, with versioned patches, dry-run
mode and multi-datasource support.

See the [`@datacapy/migrate` README](package/migrate/README.md), or go straight
to a guide:

- [Architecture](package/migrate/docs/architecture/index.md): components, execution flow, runtime safety
- [Best Practices](package/migrate/docs/best-practices/index.md): dos and don'ts, testing and rollback, common patterns
- [Advanced Usage](package/migrate/docs/advanced-usage/index.md): multi-datasource migrations, custom workflows, troubleshooting

### @datacapy/server

REST API server framework for exposing models as HTTP endpoints. Features:

- Automatic API generation from models
- Built-in ACL and role-based access control
- Express.js integration
- Configurable endpoints and middleware

See the [`@datacapy/server` README](package/server/README.md) for endpoint
configuration, ACL rules and server options, and
[`example1.js`](package/server/examples/example1.js) for a runnable setup.

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
pnpm build:om
pnpm build:schema
pnpm build:server
pnpm build:id
pnpm build:migrate

# Test specific package
pnpm test:om
pnpm test:schema
pnpm test:server
pnpm test:id
pnpm test:migrate

# Clean build outputs
pnpm clean

# Format code
pnpm format
```

## License

[BSD 3-Clause](LICENSE)
