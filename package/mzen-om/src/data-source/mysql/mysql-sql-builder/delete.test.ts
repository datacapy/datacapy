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
})
