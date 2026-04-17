# Mzen Monorepo

A TypeScript-based ODM/ORM framework with schema validation, REST API generation, and utilities for building data-driven applications.

## Packages

### mzen-om

Object mapper providing ODM/ORM functionality for TypeScript applications. Supports multiple data sources including MongoDB and MySQL, with features like:

- Model management and repositories
- Relationship handling (has-one, has-many, belongs-to)
- Query building and population
- Field-level at-rest encryption
- Service layer abstraction

### mzen-schema

Schema validation, formatting, and filtering library. Provides:

- Type-safe schema definitions
- Data validation and type casting
- Field filtering and sanitization
- Constructor initialization
- Query validation

### mzen-server

REST API server framework for exposing models as HTTP endpoints. Features:

- Automatic API generation from models
- Built-in ACL and role-based access control
- Express.js integration
- Configurable endpoints and middleware

### mzen-id

Utility for generating Base62-encoded UUIDs, designed as a relational database-friendly alternative to MongoDB's ObjectId format.

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

# Clean build outputs
pnpm clean

# Format code
pnpm format
```

## License

BSD-3-Clause
