import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

const numCompare = (field: string) =>
  `(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.${field}')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.${field}') ELSE NULL END)`

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
      expect(stripped).toBe(`${numCompare('age')} = ?`)
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
        `(jdoc->>'$.nameFirst' = ? AND jdoc->>'$.nameLast' = ? AND ${numCompare('age')} > ?)`
      )
      // Params are in clause order: nameFirst, nameLast, age
      expect(result.params).toEqual(['John', 'Smith', 25])
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
      expect(stripped).toBe(`NOT (${numCompare('age')} < ?)`)
      expect(result.params).toEqual([18])
    })

    it('should handle $nor operator', async () => {
      const query = { $nor: [{ age: { $lt: 18 } }, { name: 'John' }] }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe(
        `NOT (${numCompare('age')} < ? OR jdoc->>'$.name' = ?)`
      )
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
        `((${numCompare('age')} >= ? AND ${numCompare('age')} <= ?) OR jdoc->>'$.name' = ?)`
      )
      // Params are in clause order: age>=, age<=, name
      expect(result.params).toEqual([18, 65, 'John'])
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

  describe('$nin operator', () => {
    it('should handle $nin operator', async () => {
      const query = { status: { $nin: ['active', 'pending'] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("NOT (jdoc->>'$.status' IN (?, ?))")
      expect(result.params).toEqual(['active', 'pending'])
    })

    it('should match everything when $nin operand is an empty array', async () => {
      const query = { status: { $nin: [] } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe('NOT (1=0)')
      expect(result.params).toEqual([])
    })
  })

  describe('$like operator', () => {
    it('should use LOWER() to force case-insensitive matching', async () => {
      const query = { name: { $like: 'John%' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("LOWER(jdoc->>'$.name') LIKE ?")
      expect(result.params).toEqual(['john%'])
    })

    it('should lowercase the param regardless of input casing', async () => {
      const query = { email: { $like: '%ACME%' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("LOWER(jdoc->>'$.email') LIKE ?")
      expect(result.params).toEqual(['%acme%'])
    })
  })
})
