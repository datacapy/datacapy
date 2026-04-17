# mzen-om

NodeJS Object Document Mapping (ODM) framework for building robust applications
with MongoDB and MySQL support.

## Key Features

- **Model Elements** - Define your application with Schemas, Repositories, and
  Services
- **Relations** - Comprehensive relation system (hasOne, hasMany, belongsTo,
  etc.)
- **Validation** - Built-in and custom validators with type-casting
- **Field-Level Encryption** - Transparent at-rest encryption for sensitive
  schema fields
- **Multi-DataSource Support** - Dynamic datasource routing for multi-tenant
  architectures
- **Composite Keys** - Advanced multi-field relation matching
- **Query Optimization** - Automatic query optimization for efficient database
  operations

## Quick Start

### Define a Schema

```typescript
import { Schema } from 'mzen-om'

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, validator: 'email' },
  age: { type: Number, min: 0 },
})
```

### Create a Repository

```typescript
import { Repo } from 'mzen-om'

export class RepoUser extends Repo<User> {
  constructor() {
    super({
      name: 'user',
      schema: userSchema,
      relations: {
        posts: {
          type: 'hasMany',
          repo: 'post',
          pkey: '_id',
          key: 'authorId',
        },
      },
    })
  }
}
```

### Use in Services

```typescript
const repo = new RepoUser()

// Find with relations
const users = await repo.find(
  {},
  {
    populate: {
      posts: true,
    },
  }
)

// Insert
await repo.insert({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
})
```

## Core Concepts

### Model Elements

- **Schemas** - Define data structure and validation rules
- **Repositories** - Handle data persistence and queries
- **Services** - Implement business logic and coordinate repositories

### Relations

Support for common relation types:

- `hasOne` / `hasMany` - Parent has related children
- `belongsToOne` / `belongsToMany` - Child belongs to parent(s)
- `hasManyCount` - Count of related documents
- Embedded relations for nested data structures

See [Relations Documentation](docs/relations.md) for details.

### Validation

Built-in validators:

- `required`, `notNull`, `notEmpty`
- `length` (min/max for strings and arrays)
- `regex` pattern matching
- `email` format validation
- Custom validators

See [Validation Documentation](docs/validation.md) for details.

### Dynamic DataSource Resolution

Multi-tenant support with runtime datasource routing:

```typescript
import { DataSourceContext } from 'mzen-om'

// Create context for routing
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
})

// Use context in queries
const surveys = await repo.find(query, { context })
```

See [DataSource Context Documentation](docs/dynamic-datasource.md) for details.

## Documentation

### Core Documentation

- [Architecture](docs/architecture.md) - System design and components
- [Relations](docs/relations.md) - Relation system overview
- [Validation](docs/validation.md) - Data validation and type-casting

### Advanced Features

- [Composite Keys](docs/composite-keys.md) - Multi-field relation matching
- [DataSource Context](docs/dynamic-datasource.md) - Multi-datasource support
- [Encryption](docs/encryption.md) - Field-level at-rest encryption
- [Performance](docs/performance.md) - Optimization strategies

### Development

- [Testing](docs/testing.md) - Testing guide and patterns
- [Debugging](docs/debugging.md) - Troubleshooting guide

## Multi-DataSource Configuration

### Register Lookup Implementation

```typescript
import { DataSourceLookup } from 'mzen-om'

const projectLookup: DataSourceLookup = {
  async lookup(dataSourceName, lookupKey) {
    // Fetch project configuration
    const project = await db.projects.findOne({ _id: lookupKey })

    return {
      type: 'mongodb',
      config: {
        uri: project.databaseUri,
        database: project.databaseName,
      },
    }
  },
}

modelManager.setDataSourceLookup('project', projectLookup)
```

### Configure Repositories

```typescript
export class RepoSurvey extends Repo<Survey> {
  constructor() {
    super({
      name: 'survey',
      dataSource: 'project', // Dynamic routing
    })
  }
}
```

### Use in Services

```typescript
async getAll({ projectId }) {
  const context = DataSourceContext.fromDataSources({
    project: { lookupKey: projectId }
  })

  return await this.getRepo('survey').find({}, { context })
}
```

## Examples

### Cross-DataSource Relations

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})

await repoSurvey.findOne(surveyId, {
  context,
  populate: {
    tenant: true, // Automatically uses 'tenant' context
  },
})
```

### Composite Key Relations

```typescript
relations: {
  participant: {
    type: 'belongsToOne',
    repo: 'surveyParticipant',
    key: 'participantId',
    keys: {
      surveyId: 'surveyId',
      projectId: 'projectId'
    }
  }
}
```

## License

[Add your license here]
