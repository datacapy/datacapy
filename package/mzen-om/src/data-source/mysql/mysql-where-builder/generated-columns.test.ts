import { MysqlWhereBuilder, ColumnExistsChecker } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Generated Column Optimization', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  it('should use generated column when available for date queries', async () => {
    // Mock the column existence checker
    const mockChecker: ColumnExistsChecker = jest.fn().mockResolvedValue(true)
    whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { created_at: { $gte: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)

    // Should use the generated column instead of CAST
    expect(stripped).toBe('`gen_created_at` >= ?')
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should fallback to CAST when no generated column exists', async () => {
    // Mock the column existence checker to return false
    const mockChecker: ColumnExistsChecker = jest.fn().mockResolvedValue(false)
    whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { created_at: { $gte: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)

    // Should fallback to STR_TO_DATE expression
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.created_at')), 19), '%Y-%m-%dT%H:%i:%s') >= ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should use generated column for non-date fields when available', async () => {
    // Mock the column existence checker
    const mockChecker: ColumnExistsChecker = jest.fn().mockResolvedValue(true)
    whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

    const query = { name: 'John' }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)

    // Should use the generated column instead of JSON path
    expect(stripped).toBe('`gen_name` = ?')
    expect(result.params).toEqual(['John'])
  })

  it('should handle nested field generated columns', async () => {
    // Mock the column existence checker
    const mockChecker: ColumnExistsChecker = jest.fn().mockResolvedValue(true)
    whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

    const query = { 'address.city': 'New York' }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)

    // Should use the generated column
    expect(stripped).toBe('`gen_address_city` = ?')
    expect(result.params).toEqual(['New York'])
  })

  it('should work without column checker set', async () => {
    const freshWhereBuilder = new MysqlWhereBuilder()

    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { created_at: { $gte: testDate } }
    const result = await freshWhereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)

    // Should fallback to STR_TO_DATE expression when no checker is set
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.created_at')), 19), '%Y-%m-%dT%H:%i:%s') >= ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })
})
