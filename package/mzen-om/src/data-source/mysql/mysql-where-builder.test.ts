import { MysqlWhereBuilder, ColumnExistsChecker } from './mysql-where-builder'
import { JSON_DOCUMENT_COLUMN_NAME } from './mysql-constants'
import { stripWhitespace } from './mysql-sql-utils'

describe('MysqlWhereBuilder', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  describe('buildWhereClause', () => {
    it('should handle simple equality', async () => {
      const query = { name: 'John' }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' = ?")
      expect(result.params).toEqual(['John'])
    })

    it('should handle $eq operator', async () => {
      const query = { age: { $eq: 30 } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.age' = ?")
      expect(result.params).toEqual([30])
    })

    it('should handle $and operator', async () => {
      const query = {
        $and: [{ nameFirst: 'John', nameLast: 'Smith' }, { age: { $gt: 25 } }],
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "(jdoc->>'$.nameFirst' = ? AND jdoc->>'$.nameLast' = ? AND jdoc->>'$.age' > ?)"
      )
      expect(result.params).toEqual([25, 'John', 'Smith'])
    })

    it('should handle $or operator', async () => {
      const query = { $or: [{ name: 'John' }, { name: 'Jane' }] }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("(jdoc->>'$.name' = ? OR jdoc->>'$.name' = ?)")
      expect(result.params).toEqual(['John', 'Jane'])
    })

    it('should handle $not operator', async () => {
      const query = { $not: { age: { $lt: 18 } } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("NOT (jdoc->>'$.age' < ?)")
      expect(result.params).toEqual([18])
    })

    it('should handle $nor operator', async () => {
      const query = { $nor: [{ age: { $lt: 18 } }, { name: 'John' }] }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("NOT (jdoc->>'$.age' < ? OR jdoc->>'$.name' = ?)")
      expect(result.params).toEqual([18, 'John'])
    })

    it('should handle nested logical operators', async () => {
      const query = {
        $or: [
          { $and: [{ age: { $gte: 18 } }, { age: { $lte: 65 } }] },
          { name: 'John' },
        ],
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "((jdoc->>'$.age' >= ? AND jdoc->>'$.age' <= ?) OR jdoc->>'$.name' = ?)"
      )
      expect(result.params).toEqual(['John', 18, 65])
    })

    it('should handle $in operator', async () => {
      const query = { status: { $in: ['active', 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.status' IN (?, ?)")
      expect(result.params).toEqual(['active', 'pending'])
    })

    it('should handle $like operator', async () => {
      const query = { name: { $like: 'John%' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' LIKE ?")
      expect(result.params).toEqual(['John%'])
    })

    it('should handle $regex operator with string pattern', async () => {
      const query = { name: { $regex: '^John' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['^John'])
    })

    it('should handle $regex operator with RegExp object', async () => {
      const query = { name: { $regex: /^John/ } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['^John'])
    })

    it('should handle $regex operator with case-insensitive RegExp', async () => {
      const query = { name: { $regex: /^john/i } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['(?i)^john'])
    })

    it('should handle $regex operator with sibling $options', async () => {
      const query = { name: { $regex: '^john', $options: 'i' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['(?i)^john'])
    })

    it('should handle $regex without $options', async () => {
      const query = { name: { $regex: '^John' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['^John'])
    })

    it('should handle $regex with complex pattern', async () => {
      const query = {
        email: { $regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.email' REGEXP ?")
      expect(result.params).toEqual([
        '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      ])
    })

    it('should handle $regex combined with other conditions', async () => {
      const query = {
        name: { $regex: '^John' },
        age: { $gte: 18 },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ? AND jdoc->>'$.age' >= ?")
      expect(result.params).toEqual(['^John', 18])
    })

    it('should throw error for invalid $regex operand', async () => {
      const query = { name: { $regex: 123 } }
      await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
        'Invalid operand for $regex'
      )
    })

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
      expect(stripped).toBe("jdoc->>'$.name' IS NOT NULL")
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

    it('should handle mixed null and non-null conditions', async () => {
      const query = {
        name: null,
        age: { $gt: 18 },
        status: { $ne: null },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL' AND jdoc->>'$.age' > ? AND jdoc->>'$.status' IS NOT NULL"
      )
      expect(result.params).toEqual([18])
    })

    it('should handle boolean values with direct equality', async () => {
      const query = { isActive: true }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') = ?")
      expect(result.params).toEqual([true])
    })

    it('should handle boolean values with $eq operator', async () => {
      const query = { isActive: { $eq: false } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') = ?")
      expect(result.params).toEqual([false])
    })

    it('should handle boolean values with $ne operator', async () => {
      const query = { isActive: { $ne: true } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.isActive') != ?")
      expect(result.params).toEqual([true])
    })

    it('should handle mixed boolean, null, and other types', async () => {
      const query = {
        isActive: true,
        name: null,
        age: { $eq: 25 },
        status: { $ne: false },
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "JSON_EXTRACT(jdoc, '$.isActive') = ? AND JSON_TYPE(JSON_EXTRACT(jdoc, '$.name')) = 'NULL' AND jdoc->>'$.age' = ? AND JSON_EXTRACT(jdoc, '$.status') != ?"
      )
      expect(result.params).toEqual([true, 25, false])
    })

    it('should handle nested boolean fields', async () => {
      const query = { 'publish.published': true }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("JSON_EXTRACT(jdoc, '$.publish.published') = ?")
      expect(result.params).toEqual([true])
    })

    it('should cast Date operand to MySQL format with $eq operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $eq: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) = ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $ne operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $ne: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) != ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $gt operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $gt: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) > ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $gte operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $gte: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) >= ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $lt operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $lt: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) < ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $lte operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $lte: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) <= ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })

    it('should cast Date operand to MySQL format with $like operator', async () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { createdAt: { $like: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.createdAt' LIKE ?")
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
        "(CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) >= ? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) <= ?)"
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
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.timestamp')) AS DATETIME) = ?"
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
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.createdAt')) AS DATETIME) >= ? AND jdoc->>'$.status' = ? AND JSON_EXTRACT(jdoc, '$.isActive') = ? AND jdoc->>'$.priority' > ?"
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
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.expiresAt')) AS DATETIME) <= ?"
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

  describe('data type handling analysis', () => {
    it('should test numeric comparisons - current behavior', async () => {
      // Test integers
      const queryInt = { score: 100 }
      const resultInt = await whereBuilder.buildWhereClause(queryInt)
      const strippedInt = stripWhitespace(resultInt.clause)
      expect(strippedInt).toBe("jdoc->>'$.score' = ?")
      expect(resultInt.params).toEqual([100])

      // Test floats
      const queryFloat = { rating: 4.5 }
      const resultFloat = await whereBuilder.buildWhereClause(queryFloat)
      const strippedFloat = stripWhitespace(resultFloat.clause)
      expect(strippedFloat).toBe("jdoc->>'$.rating' = ?")
      expect(resultFloat.params).toEqual([4.5])

      // Test zero
      const queryZero = { count: 0 }
      const resultZero = await whereBuilder.buildWhereClause(queryZero)
      const strippedZero = stripWhitespace(resultZero.clause)
      expect(strippedZero).toBe("jdoc->>'$.count' = ?")
      expect(resultZero.params).toEqual([0])
    })

    it('should test date/string comparisons - current behavior', async () => {
      // Test date strings
      const queryDate = { createdAt: '2023-01-01' }
      const resultDate = await whereBuilder.buildWhereClause(queryDate)
      const strippedDate = stripWhitespace(resultDate.clause)
      expect(strippedDate).toBe("jdoc->>'$.createdAt' = ?")
      expect(resultDate.params).toEqual(['2023-01-01'])

      // Test regular strings
      const queryString = { name: 'John' }
      const resultString = await whereBuilder.buildWhereClause(queryString)
      const strippedString = stripWhitespace(resultString.clause)
      expect(strippedString).toBe("jdoc->>'$.name' = ?")
      expect(resultString.params).toEqual(['John'])
    })

    it('should test potential numeric edge cases', async () => {
      // Test zero (could be confused with false)
      const queryZero = { count: 0 }
      const resultZero = await whereBuilder.buildWhereClause(queryZero)
      expect(resultZero.params).toEqual([0])

      // Test negative numbers
      const queryNeg = { balance: -100 }
      const resultNeg = await whereBuilder.buildWhereClause(queryNeg)
      expect(resultNeg.params).toEqual([-100])

      // Test large numbers
      const queryLarge = { userId: 9007199254740991 } // MAX_SAFE_INTEGER
      const resultLarge = await whereBuilder.buildWhereClause(queryLarge)
      expect(resultLarge.params).toEqual([9007199254740991])

      // Test decimal precision
      const queryDecimal = { price: 19.99 }
      const resultDecimal = await whereBuilder.buildWhereClause(queryDecimal)
      expect(resultDecimal.params).toEqual([19.99])
    })
  })

  describe('generated column optimization', () => {
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
      const mockChecker: ColumnExistsChecker = jest
        .fn()
        .mockResolvedValue(false)
      whereBuilder.setColumnExistsChecker(mockChecker, 'test_table')

      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { created_at: { $gte: testDate } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      // Should fallback to CAST expression
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.created_at')) AS DATETIME) >= ?"
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

      // Should fallback to CAST expression when no checker is set
      expect(stripped).toBe(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(jdoc, '$.created_at')) AS DATETIME) >= ?"
      )
      expect(result.params).toEqual(['2023-01-01 12:00:00'])
    })
  })

  describe('updateMany with null check (regression test)', () => {
    it('should properly match records where field exists and is null', async () => {
      // This test verifies the fix for the reported bug where updateMany
      // with {stopped: null} should only match records where 'stopped' field
      // exists and is explicitly set to null, not records where the field is missing
      const query = {
        surveyId: '123',
        projectId: '456',
        stopped: null,
      }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)

      expect(stripped).toBe(
        "jdoc->>'$.surveyId' = ? AND jdoc->>'$.projectId' = ? AND JSON_TYPE(JSON_EXTRACT(jdoc, '$.stopped')) = 'NULL'"
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
      // (if implemented), but with IS NOT NULL we get records where field exists and is not null
      const queryNotNull = { status: { $ne: null } }
      const resultNotNull = await whereBuilder.buildWhereClause(queryNotNull)

      // This checks that the field is not null (includes missing fields)
      expect(stripWhitespace(resultNotNull.clause)).toBe(
        "jdoc->>'$.status' IS NOT NULL"
      )
    })
  })

  describe('$exists operator', () => {
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
      const resultNotExists =
        await whereBuilder.buildWhereClause(queryNotExists)
      expect(stripWhitespace(resultNotExists.clause)).toBe(
        "NOT JSON_CONTAINS_PATH(jdoc, 'one', '$.status')"
      )

      // Field exists and is null
      const queryNull = { status: null }
      const resultNull = await whereBuilder.buildWhereClause(queryNull)
      expect(stripWhitespace(resultNull.clause)).toBe(
        "JSON_TYPE(JSON_EXTRACT(jdoc, '$.status')) = 'NULL'"
      )

      // Field exists and is not null
      const queryNotNull = { status: { $ne: null } }
      const resultNotNull = await whereBuilder.buildWhereClause(queryNotNull)
      expect(stripWhitespace(resultNotNull.clause)).toBe(
        "jdoc->>'$.status' IS NOT NULL"
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
})
