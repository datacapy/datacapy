import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - Backward compatibility', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  it('should expose utility functions for backward compatibility', () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    expect(sqlBuilder.dateToMysqlString(testDate)).toBe('2023-01-01 12:00:00')
    expect(sqlBuilder.stripWhitespace('  SELECT   *  FROM   users  ')).toBe(
      'SELECT * FROM users'
    )
    expect(sqlBuilder.sanitizeIdentifier('valid_name')).toBe('valid_name')
    expect(sqlBuilder.quoteIdentifier('table_name')).toBe('`table_name`')
    expect(sqlBuilder.jsonExtract('doc', "'$.field'")).toBe(
      "JSON_EXTRACT(doc, '$.field')"
    )
    expect(sqlBuilder.jsonUnquote('value')).toBe('JSON_UNQUOTE(value)')
    expect(sqlBuilder.left('column', 10)).toBe('LEFT(column, 10)')
    expect(sqlBuilder.strTodate('2023-01-01', '%Y-%m-%d')).toBe(
      "STR_TO_DATE(2023-01-01, '%Y-%m-%d')"
    )
  })

  it('should expose WHERE clause building', async () => {
    const query = { name: 'John', age: { $gt: 25 } }
    const result = await sqlBuilder.buildWhereClause(query)
    expect(result.clause).toContain("jdoc->>'$.name' = ?")
    expect(result.clause).toContain(
      "(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.age')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.age') ELSE NULL END) > ?"
    )
    expect(result.params).toEqual(['John', 25])
  })

  it('should expose DDL operations', () => {
    expect(sqlBuilder.buildCreateTableQuery('users', '_id', 36)).toContain(
      'CREATE TABLE'
    )
    expect(sqlBuilder.buildDropTableQuery('users')).toContain('DROP TABLE')
    expect(sqlBuilder.buildColumnExistsQuery()).toContain(
      'information_schema.COLUMNS'
    )
    expect(sqlBuilder.buildIndexExistsQuery()).toContain(
      'information_schema.STATISTICS'
    )
    expect(sqlBuilder.buildTableExistsQuery()).toContain(
      'information_schema.TABLES'
    )
    expect(
      sqlBuilder.buildCreateColumnQuery(
        'users',
        'gen_name',
        'name',
        255,
        'utf8mb4'
      )
    ).toContain('ALTER TABLE')
    expect(
      sqlBuilder.buildCreateIndexQuery('users', 'idx_name', 'gen_name', true)
    ).toContain('CREATE UNIQUE INDEX')
    expect(sqlBuilder.buildDropIndexQuery('users', 'idx_name')).toContain(
      'DROP INDEX'
    )
    expect(sqlBuilder.buildGetIndexesQuery()).toContain('SELECT INDEX_NAME')
  })
})
