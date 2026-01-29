# Testing

## Test Coverage

Mzen has comprehensive test coverage for all core features:

- **Relation tests** - All relation types (belongsTo, has, embedded)
- **Backward compatibility tests** - Ensure existing single-key relations work
- **Composite key tests** - Verify multi-column joins work correctly
- **Edge case tests** - No matches, missing fields, array handling
- **Query optimization tests** - Verify composite key query optimization

## Test Files

### Relation Tests

Located in `src/repo-populator/relation/_tests/`:

- `*.test.ts` - Tests for all relation types
- `composite-keys.test.ts` - Composite key specific tests
- `composite-keys-optimization.test.ts` - Query optimization tests

### Testing Dynamic Datasources

When testing code that uses dynamic datasources:

1. **Mock the lookup** by implementing DataSourceLookup interface
2. **Register the mock** with `modelManager.setDataSourceLookup(name, mockLookup)`
3. **Create context** with test lookup keys
4. **Verify queries** execute on correct datasource

Example:

```typescript
import { DataSourceContext, DataSourceLookup } from 'mzen-om'

describe('Dynamic datasource tests', () => {
  let mockLookup: DataSourceLookup

  beforeEach(() => {
    mockLookup = {
      async lookup(dataSourceName, lookupKey) {
        return {
          type: 'mysql',
          config: { database: `test_${lookupKey}` }
        }
      }
    }

    modelManager.setDataSourceLookup('project', mockLookup)
  })

  it('should query correct datasource', async () => {
    const context = DataSourceContext.fromDataSources({
      project: { lookupKey: 'proj123' }
    })

    const results = await repo.find({}, { context })
    expect(results).toBeDefined()
  })
})
```

## MockDataSource

The mock data source was extended to support `$or` queries, which are required for composite key matching.

See [src/data-source/mock.ts](../src/data-source/mock.ts) for implementation details.

### Using MockDataSource

```typescript
import { MockDataSource } from 'mzen-om'

const mockDataSource = new MockDataSource({
  data: {
    users: [
      { _id: '1', name: 'Alice', projectId: 'p1' },
      { _id: '2', name: 'Bob', projectId: 'p2' }
    ],
    posts: [
      { _id: '10', title: 'Post 1', authorId: '1', projectId: 'p1' },
      { _id: '11', title: 'Post 2', authorId: '2', projectId: 'p2' }
    ]
  }
})
```

### Testing Relations

```typescript
describe('Relation population', () => {
  let repoPost: RepoPost
  let repoUser: RepoUser

  beforeEach(() => {
    const mockDataSource = new MockDataSource({
      data: {
        posts: [
          { _id: '1', title: 'Hello', authorId: 'user1' }
        ],
        users: [
          { _id: 'user1', name: 'Alice' }
        ]
      }
    })

    repoPost = new RepoPost()
    repoUser = new RepoUser()

    // Configure repos to use mock datasource
    repoPost.setDataSource(mockDataSource)
    repoUser.setDataSource(mockDataSource)
  })

  it('should populate belongsToOne relation', async () => {
    const posts = await repoPost.find({}, {
      populate: { author: true }
    })

    expect(posts[0].author).toBeDefined()
    expect(posts[0].author.name).toBe('Alice')
  })
})
```

## Common Testing Patterns

### Testing Composite Keys

```typescript
it('should match on composite keys', async () => {
  const mockDataSource = new MockDataSource({
    data: {
      responses: [
        { _id: '1', participantId: 'p1', surveyId: 's1', projectId: 'proj1' }
      ],
      participants: [
        { _id: 'p1', surveyId: 's1', projectId: 'proj1', name: 'Alice' }
      ]
    }
  })

  const responses = await repoResponse.find({}, {
    populate: { participant: true }
  })

  expect(responses[0].participant.name).toBe('Alice')
})
```

### Testing Validation

```typescript
it('should validate required fields', async () => {
  await expect(async () => {
    await repo.insert({})
  }).rejects.toThrow('name is required')
})

it('should validate email format', async () => {
  await expect(async () => {
    await repo.insert({ email: 'invalid' })
  }).rejects.toThrow('Invalid email format')
})
```

### Testing with Contexts

```typescript
describe('Multi-tenant queries', () => {
  it('should route to correct datasource', async () => {
    const context = DataSourceContext.fromDataSources({
      project: { lookupKey: 'project123' }
    })

    const surveys = await repoSurvey.find({}, { context })

    // Verify results are from correct datasource
    expect(surveys).toBeDefined()
  })

  it('should handle missing context error', async () => {
    await expect(async () => {
      await repoSurvey.find({})
    }).rejects.toThrow('No datasource context provided')
  })
})
```

## Best Practices

1. **Isolate Tests** - Use beforeEach/afterEach to set up and tear down test data
2. **Mock External Dependencies** - Use MockDataSource for database operations
3. **Test Edge Cases** - Empty results, missing fields, null values
4. **Test Error Conditions** - Validation failures, missing contexts, lookup failures
5. **Use Descriptive Names** - Test names should clearly describe what they verify

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- composite-keys.test.ts

# Run with coverage
npm test -- --coverage
```

## See Also

- [Architecture](architecture.md) - Understanding the system structure
- [Relations](relations.md) - Testing relation population
- [DataSource Context](datasource-context.md) - Testing dynamic datasources
- [Validation](validation.md) - Testing validation rules
