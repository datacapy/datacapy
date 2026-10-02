// cspell:ignore elemMatch
import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - buildDeleteQuery', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  it('should build DELETE query with WHERE clause', async () => {
    const query = { id: 'test123' }
    const result = await sqlBuilder.buildDeleteQuery('users', query)

    expect(result.sql).toContain('DELETE FROM `users`')
    expect(result.sql).toContain('WHERE')
    expect(result.sql).toContain("jdoc->>'$.id' = ?")
    expect(result.values).toEqual(['test123'])
  })

  it('should build DELETE query with LIMIT 1 when specified', async () => {
    const query = { id: 'test123' }
    const result = await sqlBuilder.buildDeleteQuery('users', query, true)

    expect(result.sql).toContain('LIMIT 1')
  })

  it('should reject rather than build an unscoped DELETE when the query uses only unregistered operators', async () => {
    // Regression: previously an unregistered operator was silently dropped
    // from the WHERE clause, so this produced `DELETE FROM \`users\`` with
    // no WHERE clause at all - deleting every row instead of throwing.
    const query = { workspaceId: { $elemMatch: { foo: 'bar' } } }
    await expect(sqlBuilder.buildDeleteQuery('users', query)).rejects.toThrow(
      'Invalid query operator'
    )
  })
})
