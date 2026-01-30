# Relations

## Overview

Mzen uses a sophisticated relation system for joining data across repositories, similar to ORMs. The system supports automatic population of related documents with query optimization.

## Relation Types

The system supports various relation types:

### belongsToOne
A document belongs to a single related document.

```typescript
relations: {
  user: {
    type: 'belongsToOne',
    repo: 'user',
    key: 'userId',  // Field in this document
    pkey: '_id'     // Field in related document (optional, defaults to '_id')
  }
}
```

### belongsToMany
A document belongs to multiple related documents using an array of IDs.

```typescript
relations: {
  tags: {
    type: 'belongsToMany',
    repo: 'tag',
    key: 'tagIds',  // Array field in this document
    pkey: '_id'
  }
}
```

### hasOne
A document has one related document.

```typescript
relations: {
  profile: {
    type: 'hasOne',
    repo: 'userProfile',
    pkey: '_id',        // Field in this document
    key: 'userId'       // Field in related document
  }
}
```

### hasMany
A document has many related documents.

```typescript
relations: {
  posts: {
    type: 'hasMany',
    repo: 'post',
    pkey: '_id',      // Field in this document
    key: 'authorId'   // Field in related documents
  }
}
```

### hasManyCount
Returns count of related documents instead of the documents themselves.

```typescript
relations: {
  postCount: {
    type: 'hasManyCount',
    repo: 'post',
    pkey: '_id',
    key: 'authorId'
  }
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

Define relations in your repository configuration:

```typescript
export class RepoPost extends Repo<Post> {
  constructor() {
    super({
      name: 'post',
      relations: {
        author: {
          type: 'belongsToOne',
          repo: 'user',
          key: 'authorId'
        },
        comments: {
          type: 'hasMany',
          repo: 'comment',
          pkey: '_id',
          key: 'postId'
        }
      }
    })
  }
}
```

### Populating Relations

Relations can be populated automatically or manually:

```typescript
// Auto-populate in query
const posts = await repoPost.find({}, {
  populate: {
    author: true,
    comments: true
  }
})

// Nested population
const posts = await repoPost.find({}, {
  populate: {
    author: true,
    comments: {
      populate: {
        user: true  // Populate user on each comment
      }
    }
  }
})

// Manual population on existing results
await repoPost.populate(posts, {
  author: true,
  comments: true
})
```

## Auto-Population

Relations can be configured to auto-populate by default:

```typescript
relations: {
  author: {
    type: 'belongsToOne',
    repo: 'user',
    key: 'authorId',
    autoPopulate: true  // Always populate by default
  }
}

// Can be disabled in specific queries
const posts = await repoPost.find({}, {
  populate: {
    author: false  // Disable auto-population
  }
})
```

## Query Optimization

The relation system includes basic query optimization:
- Batches queries to minimize database round-trips
- Uses `$in` operator for single-key lookups (most efficient)
- Optimizes composite key queries (see [Composite Keys](composite-keys.md))

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

Relations support composite keys for multi-field matching. See [Composite Keys](composite-keys.md) for detailed information.

### Cross-DataSource Relations

Relations can span multiple datasources. See [DataSource Context](dynamic-datasource.md) for details.

## See Also

- [Composite Keys](composite-keys.md) - Multi-field relation matching
- [Architecture](architecture.md) - Overall system design
- [Testing](testing.md) - How to test relations
