# Architecture

## Core Concepts Overview

Mzen provides an Object Document Mapping (ODM) framework for NodeJS
applications, supporting both MongoDB and MySQL databases.

## Model Elements

The framework is built on three primary model elements:

### Schemas

Schemas define data structures and validation rules for your entities. They
specify:

- Field types and structure
- Validation rules
- Default values
- Type-casting behaviour

### Repositories

Repositories are responsible for persisting data:

- Data is saved and retrieved from databases via repositories
- Each repository has a schema that defines its data structure
- Repositories can define relations between each other (one-to-many,
  many-to-many, etc.)
- Handle query operations (find, findOne, insert, update, delete)

### Services

Services handle business logic and interactions:

- Use repositories to save and load entities
- Coordinate between multiple repositories
- Implement business rules and workflows
- Examples: checkout, authenticator, report-generator, email

## Object Document Mapping (ODM)

The ODM system provides:

- Population of documents into constructor instances
- Automatic population of document relations
- Efficient query optimization

## Data Sources

Currently supports:

- MongoDB
- MySQL

Additional features:

- Dynamic datasource resolution with DataSourceContext
- Multi-datasource support for complex architectures
- Connection pooling and registry management

See [DataSource Context](dynamic-datasource.md) for detailed information.

## Transactions

Every datasource (MySQL, MongoDB, Redis) uses checkout/lease semantics:
`repo.transaction(context, fn)` checks out a dedicated transaction lease for the
duration of `fn`, rather than sharing transaction state on a cached datasource
instance. This means concurrent callers against the same registry-cached
datasource never clobber each other's transactions, and the registry will not
evict or close a pool/connection that still has an active lease
(`hasActiveLeases()`).

Each lease's shape follows its own driver's actual semantics rather than a
forced common base class: `MysqlTransactionLease` binds a dedicated
`PoolConnection`, `MongodbTransactionLease` binds a dedicated `ClientSession`,
and `RedisTransactionLease` binds a dedicated pipeline. Across all three, DDL
(`drop`/`createIndex`/`dropIndex`/`dropIndexes`) always delegates straight back
to the parent, unscoped — DDL never participates in a transaction.

See the "Transactions" section in [DataSource Context](dynamic-datasource.md)
for the call pattern, and `src/repo/repo.ts` (`transaction()`),
`src/data-source/mysql.ts` (`MysqlTransactionLease`),
`src/data-source/mongodb.ts` (`MongodbTransactionLease`), and
`src/data-source/redis.ts` (`RedisTransactionLease`) for the implementation.

## Class Hierarchy

### Relation System

```
RelationAbstract (base)
  ├── RelationHasAbstract
  │   ├── RelationHasOne
  │   ├── RelationHasMany
  │   └── RelationHasManyCount
  └── RelationBelongsToAbstract
      ├── RelationBelongsToOne
      └── RelationBelongsToMany
```

## Core Files

### Relation System

- **[src/repo-populator.ts](../src/repo-populator.ts)** - Main orchestrator for
  populating relations
- **[src/repo-populator/relation/abstract.ts](../src/repo-populator/relation/abstract.ts)** -
  Base class with shared logic
- **[src/repo-populator/relation/has-abstract.ts](../src/repo-populator/relation/has-abstract.ts)** -
  Base for `hasOne`, `hasMany` relations
- **[src/repo-populator/relation/belongs-to-abstract.ts](../src/repo-populator/relation/belongs-to-abstract.ts)** -
  Base for `belongsToOne`, `belongsToMany` relations

### DataSource System

- **[src/data-source/context.ts](../src/data-source/context.ts)** -
  DataSourceContext implementation
- **[src/data-source-manager.ts](../src/data-source-manager.ts)** - Lookup
  registration and resolution
- **[src/model-manager.ts](../src/model-manager.ts)** - Public API delegation
- **[src/data-source/registry.ts](../src/data-source/registry.ts)** - Connection
  pool management
- **[src/data-source/index.ts](../src/data-source/index.ts)** - DataSourceLookup
  interface

## Next Steps

- [Relations](relations.md) - Learn about the relation system
- [Validation](validation.md) - Learn about data validation
- [DataSource Context](dynamic-datasource.md) - Learn about multi-datasource
  support
- [Update Operators](update-operators.md) - Supported `$set`, `$push`, `$pull`,
  and other update operators
