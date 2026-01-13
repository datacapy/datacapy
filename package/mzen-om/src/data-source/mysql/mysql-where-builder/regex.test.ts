import { MysqlWhereBuilder } from '../mysql-where-builder'
import { stripWhitespace } from '../mysql-sql-utils'

describe('MysqlWhereBuilder - Regex Operator', () => {
  let whereBuilder: MysqlWhereBuilder

  beforeEach(() => {
    whereBuilder = new MysqlWhereBuilder()
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
})
