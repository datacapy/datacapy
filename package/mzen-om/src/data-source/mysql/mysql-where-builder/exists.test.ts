import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - $exists Operator', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  it('should handle $exists: true to check field exists', async () => {
    const query = { status: { $exists: true } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_CONTAINS_PATH(jdoc, 'one', '$.status')")
    expect(result.params).toEqual([])
  })

  it('should handle $exists: false to check field does not exist', async () => {
    const query = { status: { $exists: false } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("NOT JSON_CONTAINS_PATH(jdoc, 'one', '$.status')")
    expect(result.params).toEqual([])
  })

  it('should handle $exists with nested fields', async () => {
    const query = { 'address.city': { $exists: true } }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe("JSON_CONTAINS_PATH(jdoc, 'one', '$.address.city')")
    expect(result.params).toEqual([])
  })

  it('should handle $exists combined with other operators', async () => {
    const query = {
      name: { $exists: true },
      age: { $gt: 18 },
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "JSON_CONTAINS_PATH(jdoc, 'one', '$.name') AND jdoc->>'$.age' > ?"
    )
    expect(result.params).toEqual([18])
  })

  it('should handle $exists in logical operators', async () => {
    const query = {
      $or: [{ status: { $exists: false } }, { status: null }],
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "(NOT JSON_CONTAINS_PATH(jdoc, 'one', '$.status') OR JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL')"
    )
    expect(result.params).toEqual([])
  })

  it('should throw error for invalid $exists operand', async () => {
    const query = { name: { $exists: 'invalid' } }
    await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
      'Operand for $exists must be a boolean'
    )
  })

  it('should differentiate null vs missing vs existing fields', async () => {
    // Field exists with any value (including null)
    const queryExists = { status: { $exists: true } }
    const resultExists = await whereBuilder.buildWhereClause(queryExists)
    expect(stripWhitespace(resultExists.clause)).toBe(
      "JSON_CONTAINS_PATH(jdoc, 'one', '$.status')"
    )

    // Field does not exist
    const queryNotExists = { status: { $exists: false } }
    const resultNotExists = await whereBuilder.buildWhereClause(queryNotExists)
    expect(stripWhitespace(resultNotExists.clause)).toBe(
      "NOT JSON_CONTAINS_PATH(jdoc, 'one', '$.status')"
    )

    // Field exists and is null
    const queryNull = { status: null }
    const resultNull = await whereBuilder.buildWhereClause(queryNull)
    expect(stripWhitespace(resultNull.clause)).toBe(
      "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'"
    )

    // Field JSON type is not NULL
    const queryNotNull = { status: { $ne: null } }
    const resultNotNull = await whereBuilder.buildWhereClause(queryNotNull)
    expect(stripWhitespace(resultNotNull.clause)).toBe(
      "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) != 'NULL'"
    )
  })

  it('should handle complex query with $exists and null checks', async () => {
    // Find records where 'stopped' field exists but is null, and 'active' field doesn't exist
    const query = {
      stopped: null,
      active: { $exists: false },
      projectId: '123',
    }
    const result = await whereBuilder.buildWhereClause(query)
    const stripped = stripWhitespace(result.clause)
    expect(stripped).toBe(
      "JSON_TYPE(JSON_EXTRACT(jdoc, '$.stopped')) = 'NULL' AND NOT JSON_CONTAINS_PATH(jdoc, 'one', '$.active') AND jdoc->>'$.projectId' = ?"
    )
    expect(result.params).toEqual(['123'])
  })
})
