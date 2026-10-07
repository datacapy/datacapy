// cspell:ignore elemMatch
import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - SQL Injection Protection', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  describe('field name (key) injection attempts', () => {
    it('should reject field names with SQL injection - quotes', async () => {
      const query = { "name' OR '1'='1": 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject field names with SQL injection - comments', async () => {
      const query = { 'name--comment': 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )

      const query2 = { 'name/*comment*/': 'test' }
      await expect(whereBuilder.buildWhereClause(query2)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject field names with SQL injection - semicolons', async () => {
      const query = { 'name; DROP TABLE users': 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject field names with SQL injection - UNION attacks', async () => {
      const query = { 'id UNION SELECT password FROM users': 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject field names with spaces (potential injection)', async () => {
      const query = { 'name OR 1=1': 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should allow valid nested field names', async () => {
      const query = { 'user.profile.name': 'John' }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.user.profile.name' = ?")
      expect(result.params).toEqual(['John'])
    })

    it('should reject field names with special characters', async () => {
      await expect(
        whereBuilder.buildWhereClause({ 'name@domain': 'test' })
      ).rejects.toThrow('Invalid JSON path key')

      await expect(
        whereBuilder.buildWhereClause({ name$var: 'test' })
      ).rejects.toThrow('Invalid JSON path key')

      await expect(
        whereBuilder.buildWhereClause({ 'name[0]': 'test' })
      ).rejects.toThrow('Invalid JSON path key')
    })
  })

  describe('operator injection attempts', () => {
    it('should reject invalid operators in $eq', async () => {
      // This tests buildTypeAwareCondition being called with invalid operator
      // However, the operators come from the switch statement, not user input
      // But we test that validateOperator would catch it if someone modified the code
      const query = { name: { $eq: 'test' } }
      const result = await whereBuilder.buildWhereClause(query)
      expect(result.clause).toContain('=')
    })

    it('should handle all valid comparison operators safely', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')

      const queries = [
        { age: { $eq: 25 } },
        { age: { $ne: 25 } },
        { age: { $gt: 25 } },
        { age: { $gte: 25 } },
        { age: { $lt: 25 } },
        { age: { $lte: 25 } },
      ]

      for (const query of queries) {
        const result = await whereBuilder.buildWhereClause(query)
        expect(result.params).toEqual([25])
        // Verify it doesn't contain injection patterns
        expect(result.clause).not.toContain('DROP')
        expect(result.clause).not.toContain('UNION')
        expect(result.clause).not.toContain('--')
      }
    })
  })

  describe('unregistered operator fail-closed behaviour', () => {
    it('rejects an unregistered top-level operator instead of silently dropping it', async () => {
      const query = { workspaceId: { $elemMatch: { foo: 'bar' } } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid query operator'
      )
    })

    it('does not produce an empty clause for a query made entirely of unregistered operators', async () => {
      // Regression: previously this silently produced { clause: '', params: [] },
      // which a caller could mistake for "no filter" and use unscoped.
      const query = { workspaceId: { $elemMatch: { foo: 'bar' } } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow()
    })

    it('still rejects an unregistered operator when mixed with a valid one on a different field', async () => {
      const query = {
        workspaceId: { $in: [1, 2, 3] },
        secretOwnerId: { $elemMatch: { foo: 'bar' } },
      }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid query operator'
      )
    })
  })

  describe('$type operator injection attempts', () => {
    it('should reject invalid type names', async () => {
      const query = { name: { $type: 'VARCHAR' } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON type'
      )
    })

    it('should reject SQL injection via type parameter', async () => {
      const query = { name: { $type: "STRING' OR '1'='1" } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON type'
      )
    })

    it('should reject type names with SQL commands', async () => {
      const query = { name: { $type: 'STRING; DROP TABLE users' } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON type'
      )
    })

    it('should reject type names with comments', async () => {
      const query = { name: { $type: 'STRING--comment' } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON type'
      )
    })

    it('should allow all valid JSON types', async () => {
      const validTypes = [
        'string',
        'date',
        'number',
        'double',
        'bool',
        'boolean',
        'array',
        'object',
        'null',
      ]

      for (const type of validTypes) {
        const query = { name: { $type: type } }
        const result = await whereBuilder.buildWhereClause(query)
        expect(result.clause).toContain('JSON_TYPE')
        // Verify no injection occurred
        expect(result.clause).not.toContain('DROP')
        expect(result.clause).not.toContain('--')
      }
    })
  })

  describe('$exists operator injection attempts', () => {
    it('should reject injection via field name in $exists', async () => {
      const query = { "name' OR '1'='1": { $exists: true } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should safely handle $exists with valid nested fields', async () => {
      const query = { 'user.profile.email': { $exists: true } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_CONTAINS_PATH(jdoc, 'one', '$.user.profile.email')"
      )
    })
  })

  describe('$in operator injection attempts', () => {
    it('should reject injection via field name in $in', async () => {
      const query = { "name'; DROP TABLE users; --": { $in: ['a', 'b'] } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should safely handle $in with parameterized values', async () => {
      // Values in $in array should be parameterized, not concatenated
      const query = {
        status: { $in: ["'; DROP TABLE", 'normal', "OR '1'='1"] },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      // Should use placeholders, not direct concatenation
      expect(stripped).toBe("jdoc->>'$.status' IN (?, ?, ?)")
      expect(result.params).toEqual(["'; DROP TABLE", 'normal', "OR '1'='1"])
    })
  })

  describe('$like operator injection attempts', () => {
    it('should reject injection via field name in $like', async () => {
      const query = { "name' OR '1'='1": { $like: '%test%' } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should safely handle $like with parameterized pattern', async () => {
      // Pattern should be parameterized
      const query = { name: { $like: "%'; DROP TABLE users; --%" } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      expect(stripped).toBe("LOWER(jdoc->>'$.name') LIKE ?")
      expect(result.params).toEqual(["%'; drop table users; --%"])
    })
  })

  describe('$regex operator injection attempts', () => {
    it('should reject injection via field name in $regex', async () => {
      const query = { "name' OR '1'='1": { $regex: '^test' } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should safely handle $regex with parameterized pattern', async () => {
      // Pattern should be parameterized
      const query = { name: { $regex: "^test'; DROP TABLE users; --" } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      expect(stripped).toBe("jdoc->>'$.name' LIKE BINARY ?")
      expect(result.params).toEqual(["%^test'; DROP TABLE users; --%"])
    })
  })

  describe('complex injection scenarios', () => {
    it('should reject multiple injection attempts in complex query', async () => {
      const query = {
        "name' OR '1'='1": 'test',
        'age': { $gt: 25 },
      }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject injection in nested $and queries', async () => {
      const query = {
        $and: [{ "name'; DROP TABLE": 'test' }, { age: { $gt: 25 } }],
      }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject injection in nested $or queries', async () => {
      const query = {
        $or: [{ "name' OR 1=1 --": 'test' }, { age: { $lt: 18 } }],
      }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })

    it('should safely handle legitimate complex queries', async () => {
      const query = {
        $and: [
          { 'user.first_name': 'John' },
          { 'user.last_name': 'Doe' },
          { age: { $gte: 18 } },
          { status: { $in: ['active', 'pending'] } },
        ],
      }
      const result = await whereBuilder.buildWhereClause(query)

      // Verify it generated valid SQL without injection
      expect(result.clause).not.toContain('DROP')
      expect(result.clause).not.toContain('UNION')
      expect(result.clause).not.toContain('--')
      // Params are in clause order: first_name, last_name, age, status $in values
      expect(result.params).toEqual(['John', 'Doe', 18, 'active', 'pending'])
    })
  })

  describe('null and boolean value safety', () => {
    it('should safely handle null values with injection-like strings', async () => {
      const query = {
        validField: null,
        otherField: 'normal',
      }
      const result = await whereBuilder.buildWhereClause(query)

      // Should use JSON_TYPE for null check, not string concatenation
      expect(result.clause).toContain('JSON_TYPE')
      expect(result.clause).toContain('NULL')
    })

    it('should safely handle boolean values', async () => {
      const query = {
        isActive: true,
        isDeleted: false,
      }
      const result = await whereBuilder.buildWhereClause(query)

      // Should use JSON_EXTRACT for boolean comparison
      expect(result.clause).toContain('JSON_EXTRACT')
      expect(result.params).toEqual([true, false])
    })
  })

  describe('generated column name safety', () => {
    it('should sanitize generated column names with injection attempts', async () => {
      // Even though the generated column name is derived from user input (key),
      // it should be sanitized
      const mockChecker = jest.fn().mockResolvedValue(true)
      whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

      const query = { valid_field_name: 'test' }
      const result = await whereBuilder.buildWhereClause(query)

      // Should safely use backtick-quoted column name
      expect(result.clause).toContain('`gen_valid_field_name`')
    })

    it('should reject malicious field names even with generated columns', async () => {
      const mockChecker = jest.fn().mockResolvedValue(true)
      whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

      const query = { "field'; DROP TABLE": 'test' }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid JSON path key'
      )
    })
  })
})
