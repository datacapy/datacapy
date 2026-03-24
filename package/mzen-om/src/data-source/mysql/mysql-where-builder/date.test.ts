import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Date Handling', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  it('should cast Date operand to MySQL format with $eq operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $eq: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') = ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $ne operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $ne: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') != ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $gt operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $gt: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') > ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $gte operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $gte: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') >= ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $lt operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $lt: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') < ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $lte operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $lte: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') <= ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should cast Date operand to MySQL format with $like operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { createdAt: { $like: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("LOWER(jdoc->>'$.createdAt') LIKE ?")
    expect(result.params).toEqual(['2023-01-01 12:00:00'])
  })

  it('should handle multiple Date operands in complex query', async () => {
    const startDate = new Date('2023-01-01T00:00:00.000Z')
    const endDate = new Date('2023-12-31T23:59:59.000Z')
    const query = {
      $and: [
        { createdAt: { $gte: startDate } },
        { createdAt: { $lte: endDate } },
      ],
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "(STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') >= ? AND STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') <= ?)"
    )
    expect(result.params).toEqual([
      '2023-01-01 00:00:00',
      '2023-12-31 23:59:59',
    ])
  })

  it('should cast Date with milliseconds precision to MySQL format', async () => {
    const testDate = new Date('2023-01-01T12:30:45.123Z')
    const query = { timestamp: { $eq: testDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.timestamp')), 19), '%Y-%m-%dT%H:%i:%s') = ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:30:45'])
  })

  it('should cast Date operands mixed with other data types', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = {
      createdAt: { $gte: testDate },
      status: 'active',
      isActive: true,
      priority: { $gt: 5 },
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')), 19), '%Y-%m-%dT%H:%i:%s') >= ? AND jdoc->>'$.status' = ? AND JSON_EXTRACT(jdoc, '$.isActive') = ? AND jdoc->>'$.priority' > ?"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00', 'active', true, 5])
  })

  it('should cast Date operands with $in operator', async () => {
    const date1 = new Date('2023-01-01T12:00:00.000Z')
    const date2 = new Date('2023-02-01T12:00:00.000Z')
    const query = { createdAt: { $in: [date1, date2] } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("jdoc->>'$.createdAt' IN (?, ?)")
    expect(result.params).toEqual([
      '2023-01-01 12:00:00',
      '2023-02-01 12:00:00',
    ])
  })

  it('should cast Date operands mixed with other types in $in operator', async () => {
    const testDate = new Date('2023-01-01T12:00:00.000Z')
    const query = { value: { $in: [testDate, 'string', 42, null] } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "(jdoc->>'$.value' IN (?, ?, ?) OR JSON_TYPE(JSON_EXTRACT(jdoc, '$.value')) = 'NULL')"
    )
    expect(result.params).toEqual(['2023-01-01 12:00:00', 'string', 42])
  })

  it('should cast Date operands in direct comparison (deleteMany scenario)', async () => {
    const currentDate = new Date()
    const query = { expiresAt: { $lte: currentDate } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.expiresAt')), 19), '%Y-%m-%dT%H:%i:%s') <= ?"
    )
    expect(result.params).toEqual([
      currentDate
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .substring(0, 19),
    ])
  })
})
