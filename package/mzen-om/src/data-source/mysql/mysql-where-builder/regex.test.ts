import {
  MysqlWhereBuilder,
  isSimpleLiteralPattern,
} from '../mysql-where-builder'
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
    expect(stripped).toBe(
      "jdoc->>'$.name' REGEXP ? AND " +
        "(CASE WHEN JSON_TYPE(JSON_EXTRACT(jdoc, '$.age')) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN JSON_EXTRACT(jdoc, '$.age') ELSE NULL END) >= ?"
    )
    expect(result.params).toEqual(['^John', 18])
  })

  it('should throw error for invalid $regex operand', async () => {
    const query = { name: { $regex: 123 } }
    await expect(whereBuilder.buildWhereClause(query)).rejects.toThrow(
      'Invalid operand for $regex'
    )
  })

  describe('LIKE optimization for simple literal patterns', () => {
    it('should use LIKE BINARY for simple literal string pattern', async () => {
      const query = { name: { $regex: 'John' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' LIKE BINARY ?")
      expect(result.params).toEqual(['%John%'])
    })

    it('should use LOWER() for case-insensitive simple literal', async () => {
      const query = { name: { $regex: 'John', $options: 'i' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("LOWER(jdoc->>'$.name') LIKE ?")
      expect(result.params).toEqual(['%john%'])
    })

    it('should use LOWER() for case-insensitive RegExp literal', async () => {
      const query = { name: { $regex: /john/i } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("LOWER(jdoc->>'$.name') LIKE ?")
      expect(result.params).toEqual(['%john%'])
    })

    it('should lowercase the param when $options: i is set', async () => {
      const query = { email: { $regex: 'ACME', $options: 'i' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("LOWER(jdoc->>'$.email') LIKE ?")
      expect(result.params).toEqual(['%acme%'])
    })

    it('should use LIKE BINARY (case-sensitive) when no $options', async () => {
      const query = { name: { $regex: 'John' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' LIKE BINARY ?")
      expect(result.params).toEqual(['%John%'])
    })

    it('should use REGEXP for patterns with metacharacters', async () => {
      const query = { name: { $regex: 'John.*Smith' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['John.*Smith'])
    })

    it('should use REGEXP for patterns with anchors', async () => {
      const query = { name: { $regex: '^John' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['^John'])
    })

    it('should use REGEXP for patterns with character classes', async () => {
      const query = { name: { $regex: '[A-Z]ohn' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' REGEXP ?")
      expect(result.params).toEqual(['[A-Z]ohn'])
    })

    it('should handle simple literal with spaces', async () => {
      const query = { description: { $regex: 'hello world' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.description' LIKE BINARY ?")
      expect(result.params).toEqual(['%hello world%'])
    })

    it('should handle simple literal with numbers', async () => {
      const query = { code: { $regex: 'ABC123' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.code' LIKE BINARY ?")
      expect(result.params).toEqual(['%ABC123%'])
    })

    it('should handle simple literal with hyphens and underscores', async () => {
      const query = { name: { $regex: 'first-name_last' } }
      const result = await whereBuilder.buildWhereClause(query)
      const stripped = stripWhitespace(result.clause)
      expect(stripped).toBe("jdoc->>'$.name' LIKE BINARY ?")
      expect(result.params).toEqual(['%first-name_last%'])
    })
  })
})

describe('isSimpleLiteralPattern', () => {
  it('should return true for simple alphanumeric strings', () => {
    expect(isSimpleLiteralPattern('John')).toBe(true)
    expect(isSimpleLiteralPattern('ABC123')).toBe(true)
    expect(isSimpleLiteralPattern('hello world')).toBe(true)
  })

  it('should return true for strings with hyphens and underscores', () => {
    expect(isSimpleLiteralPattern('first-name')).toBe(true)
    expect(isSimpleLiteralPattern('last_name')).toBe(true)
    expect(isSimpleLiteralPattern('hello-world_test')).toBe(true)
  })

  it('should return false for patterns with dot', () => {
    expect(isSimpleLiteralPattern('hello.world')).toBe(false)
    expect(isSimpleLiteralPattern('file.txt')).toBe(false)
  })

  it('should return false for patterns with anchors', () => {
    expect(isSimpleLiteralPattern('^John')).toBe(false)
    expect(isSimpleLiteralPattern('John$')).toBe(false)
  })

  it('should return false for patterns with quantifiers', () => {
    expect(isSimpleLiteralPattern('a*')).toBe(false)
    expect(isSimpleLiteralPattern('a+')).toBe(false)
    expect(isSimpleLiteralPattern('a?')).toBe(false)
  })

  it('should return false for patterns with character classes', () => {
    expect(isSimpleLiteralPattern('[A-Z]')).toBe(false)
    expect(isSimpleLiteralPattern('(a|b)')).toBe(false)
  })

  it('should return false for patterns with escape sequences', () => {
    expect(isSimpleLiteralPattern('\\d+')).toBe(false)
    expect(isSimpleLiteralPattern('hello\\nworld')).toBe(false)
  })

  it('should return false for patterns with curly braces', () => {
    expect(isSimpleLiteralPattern('a{2,3}')).toBe(false)
  })

  it('should return false for patterns with pipe (alternation)', () => {
    expect(isSimpleLiteralPattern('cat|dog')).toBe(false)
  })
})
