import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Basic Operators', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
  })

  describe('simple equality', () => {
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
  })

  describe('logical operators', () => {
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
  })

  describe('$in operator', () => {
    it('should handle $in operator', async () => {
      const query = { status: { $in: ['active', 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.status' IN (?, ?)")
      expect(result.params).toEqual(['active', 'pending'])
    })
  })

  describe('$like operator', () => {
    it('should handle $like operator', async () => {
      const query = { name: { $like: 'John%' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' LIKE ?")
      expect(result.params).toEqual(['John%'])
    })
  })
})
