import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Null Handling', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  describe('null values', () => {
    it('should handle null values with direct equality', async () => {
      const query = { name: null }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL'")
      expect(result.params).toEqual([])
    })

    it('should handle null values with $eq operator', async () => {
      const query = { name: { $eq: null } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL'")
      expect(result.params).toEqual([])
    })

    it('should handle null values with $ne operator', async () => {
      const query = { name: { $ne: null } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) != 'NULL'")
      expect(result.params).toEqual([])
    })

    it('should handle null values in $in operator', async () => {
      const query = { status: { $in: ['active', null, 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "(jdoc->>'$.status' IN (?, ?) OR JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL')"
      )
      expect(result.params).toEqual(['active', 'pending'])
    })

    it('should handle only null values in $in operator', async () => {
      const query = { status: { $in: [null] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'"
      )
      expect(result.params).toEqual([])
    })

    it('should handle multiple null values in $in operator', async () => {
      const query = { status: { $in: [null, null] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'"
      )
      expect(result.params).toEqual([])
    })

    it('should handle non-null values in $in operator without null', async () => {
      const query = { status: { $in: ['active', 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.status' IN (?, ?)")
      expect(result.params).toEqual(['active', 'pending'])
    })

    it('should handle null values in $nin operator', async () => {
      const query = { status: { $nin: ['active', null, 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "NOT ((jdoc->>'$.status' IN (?, ?) OR JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'))"
      )
      expect(result.params).toEqual(['active', 'pending'])
    })

    it('should handle mixed null and non-null conditions', async () => {
      const query = {
        name: null,
        age: { $gt: 18 },
        status: { $ne: null },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL' AND " +
          "(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.age')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.age') ELSE NULL END) > ? AND " +
          "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) != 'NULL'"
      )
      expect(result.params).toEqual([18])
    })
  })

  describe('updateMany with null check (regression test)', () => {
    it('should properly match records where field exists and is null', async () => {
      // This test verifies the fix for the reported bug where updateMany
      // with {stopped: null} should only match records where 'stopped' field
      // exists and is explicitly set to null, not records where the field is missing
      const query = {
        surveyId: '123',
        workspaceId: '456',
        stopped: null,
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      expect(stripped).toBe(
        "jdoc->>'$.surveyId' = ? AND jdoc->>'$.workspaceId' = ? AND JSON_TYPE(JSON_EXTRACT(jdoc, '$.stopped')) = 'NULL'"
      )
      expect(result.params).toEqual(['123', '456'])
    })

    it('should distinguish between missing field and null field', async () => {
      // Query for records where field is null (field exists with null value)
      const queryNull = { status: null }
      const resultNull = await whereBuilder.buildWhereClause(queryNull)

      // The query should check for JSON NULL type
      expect(stripWhitespace(resultNull.clause)).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'"
      )

      // Query for records where field does not exist would use $exists operator
      // (if implemented), but with != NULL we get records where JSON type is not NULL
      const queryNotNull = { status: { $ne: null } }
      const resultNotNull = await whereBuilder.buildWhereClause(queryNotNull)

      // This checks that the field JSON type is not NULL
      expect(stripWhitespace(resultNotNull.clause)).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) != 'NULL'"
      )
    })
  })
})
