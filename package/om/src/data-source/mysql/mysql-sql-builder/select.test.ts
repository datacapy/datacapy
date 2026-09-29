// cspell:ignore elemMatch
import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - buildSelectQuery', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  it('should build basic SELECT query', async () => {
    const result = await sqlBuilder.buildSelectQuery('users')
    expect(result.sql).toContain('SELECT `jdoc` FROM `users`')
    expect(result.values).toEqual([])
  })

  it('should build SELECT query with WHERE clause', async () => {
    const query = { name: 'John' }
    const result = await sqlBuilder.buildSelectQuery('users', query)
    expect(result.sql).toContain('SELECT `jdoc` FROM `users`')
    expect(result.sql).toContain('WHERE')
    expect(result.sql).toContain("jdoc->>'$.name' = ?")
    expect(result.values).toEqual(['John'])
  })

  it('should build SELECT query with sorting', async () => {
    const options = { sort: { name: 1, age: -1 } }
    const result = await sqlBuilder.buildSelectQuery(
      'users',
      undefined,
      options
    )
    expect(result.sql).toContain('ORDER BY')
    expect(result.sql).toContain("jdoc->>'$.name' ASC")
    expect(result.sql).toContain("jdoc->>'$.age' DESC")
  })

  it('should build SELECT query with limit and offset', async () => {
    const options = { limit: 10, skip: 5 }
    const result = await sqlBuilder.buildSelectQuery(
      'users',
      undefined,
      options
    )
    expect(result.sql).toContain('LIMIT 10 OFFSET 5')
  })

  it('should apply skip without limit using MAX_SAFE_INTEGER as default limit', async () => {
    const options = { skip: 5 }
    const result = await sqlBuilder.buildSelectQuery(
      'users',
      undefined,
      options
    )
    expect(result.sql).toContain(`LIMIT ${Number.MAX_SAFE_INTEGER} OFFSET 5`)
  })

  it('should reject rather than build an unscoped SELECT when the query uses only unregistered operators', async () => {
    // Regression: previously an unregistered operator was silently dropped
    // from the WHERE clause, so this produced a SELECT with no WHERE clause
    // at all - returning every row instead of throwing.
    const query = { projectId: { $elemMatch: { foo: 'bar' } } }
    await expect(sqlBuilder.buildSelectQuery('users', query)).rejects.toThrow(
      'Invalid query operator'
    )
  })
})
