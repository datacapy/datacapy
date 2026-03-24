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

describe('MysqlWhereBuilder - Lowercase Generated Column Optimization', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
    // Mock checker: return true only for _lower columns
    const mockChecker: ColumnExistsChecker = jest.fn((_, col) =>
      Promise.resolve(col.endsWith('_lower'))
    )
    whereBuilder.setColumnExistsChecker(mockChecker, 'user')
  })

  it('should use gen_email_lower for $regex with $options: i', async () => {
    const query = { email: { $regex: 'acme', $options: 'i' } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe('`gen_email_lower` LIKE ?')
    expect(result.params).toEqual(['%acme%'])
  })

  it('should use gen_email_lower for case-insensitive RegExp literal', async () => {
    const query = { email: { $regex: /acme/i } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe('`gen_email_lower` LIKE ?')
    expect(result.params).toEqual(['%acme%'])
  })

  it('should use gen_email_lower for $like', async () => {
    const query = { email: { $like: '%ACME%' } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe('`gen_email_lower` LIKE ?')
    expect(result.params).toEqual(['%acme%'])
  })

  it('should lowercase the search param to match the stored column value', async () => {
    const query = { email: { $regex: 'ACME Corp', $options: 'i' } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe('`gen_email_lower` LIKE ?')
    expect(result.params).toEqual(['%acme corp%'])
  })

  it('should still use LOWER() fallback when no lowercase column exists', async () => {
    const mockChecker: ColumnExistsChecker = jest.fn().mockResolvedValue(false)
    whereBuilder.setColumnExistsChecker(mockChecker, 'user')

    const query = { email: { $regex: 'acme', $options: 'i' } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("LOWER(jdoc->>'$.email') LIKE ?")
    expect(result.params).toEqual(['%acme%'])
  })

  it('should not use lowercase column for case-sensitive $regex (no $options)', async () => {
    const query = { email: { $regex: 'Acme' } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("jdoc->>'$.email' LIKE BINARY ?")
    expect(result.params).toEqual(['%Acme%'])
  })

  it('should use gen_nameFirst_lower for $or user search pattern', async () => {
    const search = 'John'
    const query = {
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { nameFirst: { $regex: search, $options: 'i' } },
        { nameLast: { $regex: search, $options: 'i' } },
      ],
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      '(`gen_email_lower` LIKE ? OR `gen_nameFirst_lower` LIKE ? OR `gen_nameLast_lower` LIKE ?)'
    )
    expect(result.params).toEqual(['%john%', '%john%', '%john%'])
  })
})
