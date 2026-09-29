import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - Integration tests', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('column existence checker integration', () => {
    it('should delegate column optimization to WHERE builder', async () => {
      // Mock the column existence checker
      const mockChecker = jest.fn().mockResolvedValue(true)
      sqlBuilder.setColumnExistsChecker(mockChecker, 'test_table')

      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { created_at: { $gte: testDate } }
      const result = await sqlBuilder.buildSelectQuery('test_table', query)

      // Should use generated column optimization
      expect(result.sql).toContain('`gen_created_at` >= ?')
      expect(result.values).toEqual(['2023-01-01 12:00:00'])
    })
  })
})
