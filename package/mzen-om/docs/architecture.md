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
