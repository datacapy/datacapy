import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - INSERT operations', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('buildInsertOneQuery', () => {
    it('should build INSERT query for single object', () => {
      const obj = { name: 'John', age: 30 }
      const result = sqlBuilder.buildInsertOneQuery('users', obj)
      expect(result.sql).toContain('INSERT INTO `users` (jdoc)')
      expect(result.sql).toContain('VALUES (CAST(? AS JSON))')
      expect(result.values).toEqual([JSON.stringify(obj)])
    })
  })

  describe('buildInsertManyQuery', () => {
    it('should build INSERT query for multiple objects', () => {
      const objects = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]
      const result = sqlBuilder.buildInsertManyQuery('users', objects)
      expect(result.sql).toContain('INSERT INTO `users` (jdoc)')
      expect(result.sql).toContain(
        'VALUES (CAST(? AS JSON)), (CAST(? AS JSON))'
      )
      expect(result.values).toEqual([
        JSON.stringify(objects[0]),
        JSON.stringify(objects[1]),
      ])
    })

    it('should handle empty array', () => {
      const result = sqlBuilder.buildInsertManyQuery('users', [])
      expect(result.sql).toBe('')
      expect(result.values).toEqual([])
    })
  })
})
