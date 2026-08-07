import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - COUNT and GROUP operations', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('buildCountQuery', () => {
    it('should build COUNT query without WHERE clause', async () => {
      const result = await sqlBuilder.buildCountQuery('users')
      expect(result.sql).toContain('SELECT COUNT(*)')
      expect(result.sql).toContain('FROM `users`')
      expect(result.values).toEqual([])
    })

    it('should build COUNT query with WHERE clause', async () => {
      const query = { status: 'active' }
      const result = await sqlBuilder.buildCountQuery('users', query)
      expect(result.sql).toContain('SELECT COUNT(*)')
      expect(result.sql).toContain('FROM `users`')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.status' = ?")
      expect(result.values).toEqual(['active'])
    })
  })

  describe('buildFindGroupQuery', () => {
    it('should build GROUP BY query', async () => {
      const groupFields = ['status', 'department']
      const result = await sqlBuilder.buildFindGroupQuery('users', groupFields)

      expect(result.sql).toContain('SELECT')
      expect(result.sql).toContain("jdoc->>'$.status' AS status")
      expect(result.sql).toContain("jdoc->>'$.department' AS department")
      expect(result.sql).toContain('COUNT(*) AS count')
      expect(result.sql).toContain('FROM `users`')
      expect(result.sql).toContain('GROUP BY status, department')
    })

    it('should build GROUP BY query with WHERE clause', async () => {
      const groupFields = ['status']
      const query = { age: { $gte: 18 } }
      const result = await sqlBuilder.buildFindGroupQuery(
        'users',
        groupFields,
        query
      )

      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain(
        "(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.age')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.age') ELSE NULL END) >= ?"
      )
      expect(result.values).toEqual([18])
    })
  })

  describe('buildGroupCountQuery', () => {
    it('should build GROUP COUNT query', async () => {
      const groupFields = ['status']
      const result = await sqlBuilder.buildGroupCountQuery('users', groupFields)

      expect(result.sql).toContain('SELECT')
      expect(result.sql).toContain("jdoc->>'$.status' AS status")
      expect(result.sql).toContain('COUNT(*) AS count')
      expect(result.sql).toContain('GROUP BY status')
    })
  })
})
