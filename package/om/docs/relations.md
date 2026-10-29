# Relations

## Overview

Datacapy uses a sophisticated relation system for joining data across
repositories, similar to ORMs. The system supports automatic population of
related documents with query optimisation.

## Relation Types

The system supports various relation types:

### belongsToOne

A document belongs to a single related document.

```typescript
relations: {
  // key: field in this document
  // pkey: field in related document (optional, defaults to '_id')
  user: relb.belongsToOne('user').key('userId').pkey('_id'),
}
```

### belongsToMany

A document belongs to multiple related documents using an array of IDs.

```typescript
relations: {
  // key: array field in this document
  tags: relb.belongsToMany('tag').key('tagIds').pkey('_id'),
}
```

### hasOne

A document has one related document.

```typescript
relations: {
  // pkey: field in this document, key: field in related document
  profile: relb.hasOne('userProfile').pkey('_id').key('userId'),
}
```

### hasMany

A document has many related documents.

```typescript
relations: {
  // pkey: field in this document, key: field in related documents
  posts: relb.hasMany('post').pkey('_id').key('authorId'),
}
```

### hasManyCount

Returns count of related documents instead of the documents themselves.

```typescript
relations: {
  postCount: relb.hasManyCount('post').pkey('_id').key('authorId'),
}
```

### Embedded Relations

Embedded relations join on data within the same document:

- `embeddedHasOne` - Embedded one-to-one relation
- `embeddedHasMany` - Embedded one-to-many relation
- `embeddedBelongsToOne` - Embedded belongs-to-one relation
- `embeddedBelongsToMany` - Embedded belongs-to-many relation

## Basic Usage

### Defining Relations

Define relations in your repository configuration with the relation builder
(`RepoRelationBuilder`, imported under the local alias `relb`):

```typescript
import { Repo, RepoRelationBuilder as relb } from '@datacapy/om'

export class RepoPost extends Repo<Post> {
  constructor() {
    super({
      name: 'post',
      relations: {
        author: relb.belongsToOne('user').key('authorId'),
        comments: relb.hasMany('comment').pkey('_id').key('postId'),
      },
    })
  }
}
```

### Relation builder (`relb`)

`relb` is the local alias for `RepoRelationBuilder`; the library exports only
the class.

`relb` has one method per relation type, so the type string is never written by
hand. A repo accepts a builder wherever it accepts a plain config; there is no
`build()` call. Chain methods: `key`, `keys`, `pkey`, `alias`, `docPath`,
`docPathRelated`, `query`, `fields`, `recursion`, `autoPopulate`,
`filterPrivate`, `populate`, `limit`, `skip`, `sort`. Static methods:
`belongsToOne`, `belongsToMany`, `hasOne`, `hasMany`, `hasManyCount` and the
four `embedded*` types.

```typescript
relations: {
  comments: relb
    .hasMany('comment')
    .pkey('_id')
    .key('postId')
    .autoPopulate(false),
}
```

### Populating Relations

Relations can be populated automatically or manually:

```typescript
// Auto-populate in query
const posts = await repoPost.find(
  {},
  {
    populate: {
      author: true,
      comments: true,
    },
  }
)

// Nested population
const posts = await repoPost.find(
  {},
  {
    populate: {
      author: true,
      comments: {
        populate: {
          user: true, // Populate user on each comment
        },
      },
    },
  }
)

// Manual population on existing results
await repoPost.populate(posts, {
  author: true,
  comments: true,
})
```

## Auto-Population

Relations can be configured to auto-populate by default:

```typescript
relations: {
  // Always populate by default
  author: relb.belongsToOne('user').key('authorId').autoPopulate(true),
}

// Can be disabled in specific queries
const posts = await repoPost.find({}, {
  populate: {
    author: false  // Disable auto-population
  }
})
```

## Query Optimisation

The relation system includes basic query optimisation:

- Batches queries to minimise database round-trips
- Uses `$in` operator for single-key lookups (most efficient)
- Optimises composite key queries (see [Composite Keys](composite-keys.md))

## Field Direction

Understanding field direction is crucial:

### belongsTo Relations

- `key` is the field in the **current** document
- `pkey` is the field in the **related** document (defaults to `_id`)

### has Relations

- `pkey` is the field in the **current** document
- `key` is the field in the **related** documents

## Advanced Features

### Composite Keys

Relations support composite keys for multi-field matching. See
[Composite Keys](composite-keys.md) for detailed information.

### Cross-DataSource Relations

Relations can span multiple datasources. See
[DataSource Context](dynamic-datasource.md) for details.

## Security: Populated Relations Are Never Scoped

Relation population (`hasOne`, `hasMany`, `belongsToOne`, `belongsToMany`)
builds its query purely from the relation's declared foreign-key mapping - it
has no concept of ACL, tenant, or ownership scoping, and applies none. If a
document returned by an already-scoped top-level query has a foreign key
pointing at a record belonging to a different tenant/workspace (e.g. corrupted
data, or a bug elsewhere that let a cross-tenant reference get written),
population will attach that other tenant's record with no additional check.

Tenant isolation for populated data is entirely the calling application's
responsibility: either ensure the parent query's own scoping is sufficient on
its own regardless of what gets populated, or don't rely on populate to filter
by tenant. Embedded relation variants (`embeddedHasOne`, `embeddedHasMany`,
etc.) don't query the database at all, so they can't leak cross-tenant data via
a _new_ query - but they don't add any scoping of their own either.

## See Also

- [Composite Keys](composite-keys.md) - Multi-field relation matching
- [Architecture](architecture.md) - Overall system design
- [Testing](testing.md) - How to test relations
