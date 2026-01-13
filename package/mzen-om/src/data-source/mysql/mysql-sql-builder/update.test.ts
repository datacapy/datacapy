import { MysqlSqlBuilder } from '../mysql-sql-builder'
import { JSON_DOCUMENT_COLUMN_NAME } from '../mysql-constants'

describe('MysqlSqlBuilder - UPDATE operations', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('buildUpdateQuery', () => {
    it('should build UPDATE query with WHERE clause', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = { $set: { name: 'Updated Name' } }
      const result = await sqlBuilder.buildUpdateQuery(
        'users',
        querySelect,
        queryUpdate
      )

      expect(result.sql).toContain('UPDATE `users`')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.id' = ?")
      expect(result.values).toContain('Updated Name')
      expect(result.values).toContain('test123')
    })

    it('should build UPDATE query with LIMIT 1 when specified', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = { $set: { name: 'Updated Name' } }
      const result = await sqlBuilder.buildUpdateQuery(
        'users',
        querySelect,
        queryUpdate,
        true
      )

      expect(result.sql).toContain('LIMIT 1')
    })
  })

  describe('buildSetClause', () => {
    it('should handle primitive values in $set', () => {
      const queryUpdate = {
        $set: {
          name: 'John',
          age: 30,
          email: 'john@example.com',
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.name', ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.age', ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.email', ?)`
      )
      expect(result.params).toEqual(['John', 30, 'john@example.com'])
    })

    it('should handle array values in $set', () => {
      const queryUpdate = {
        $set: {
          tags: ['tag1', 'tag2', 'tag3'],
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.tags', CAST(? AS JSON))`
      )
      expect(result.params).toEqual([JSON.stringify(['tag1', 'tag2', 'tag3'])])
    })

    it('should handle nested object values in $set', () => {
      const queryUpdate = {
        $set: {
          address: { street: '123 Main St', city: 'New York' },
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.address', CAST(? AS JSON))`
      )
      expect(result.params).toEqual([
        JSON.stringify({ street: '123 Main St', city: 'New York' }),
      ])
    })

    it('should handle $unset operation', () => {
      const queryUpdate = {
        $unset: {
          age: true,
          tags: true,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME}, '$.age'), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME}, '$.tags')`
      )
      expect(result.params).toEqual([])
    })

    it('should handle $inc operation', () => {
      const queryUpdate = {
        $inc: {
          age: 1,
          score: -5,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.age', COALESCE(${JSON_DOCUMENT_COLUMN_NAME}->>'$.age', 0) + ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.score', COALESCE(${JSON_DOCUMENT_COLUMN_NAME}->>'$.score', 0) + ?)`
      )
      expect(result.params).toEqual([1, -5])
    })

    it('should handle multiple operations', () => {
      const queryUpdate = {
        $set: { name: 'John' },
        $unset: { age: true },
        $inc: { score: 10 },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.name', ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME}, '$.age'), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.score', COALESCE(${JSON_DOCUMENT_COLUMN_NAME}->>'$.score', 0) + ?)`
      )
      expect(result.params).toEqual(['John', 10])
    })

    it('should handle null values in $set', () => {
      const queryUpdate = {
        $set: {
          name: null,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.name', NULL)`
      )
      expect(result.params).toEqual([])
    })

    it('should handle multiple null values in $set', () => {
      const queryUpdate = {
        $set: {
          name: null,
          description: null,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.name', NULL), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.description', NULL)`
      )
      expect(result.params).toEqual([])
    })

    it('should handle mixed null and non-null values in $set', () => {
      const queryUpdate = {
        $set: {
          name: 'John',
          age: 30,
          description: null,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.name', ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.age', ?), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.description', NULL)`
      )
      expect(result.params).toEqual(['John', 30])
    })

    it('should handle numeric null values in $set', () => {
      const queryUpdate = {
        $set: {
          score: null,
          rating: null,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.score', NULL), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.rating', NULL)`
      )
      expect(result.params).toEqual([])
    })

    it('should handle nested field null values in $set', () => {
      const queryUpdate = {
        $set: {
          'address.city': null,
          'meta.score': null,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(sqlBuilder.stripWhitespace(result.clause)).toBe(
        `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.address.city', NULL), ` +
          `${JSON_DOCUMENT_COLUMN_NAME} = JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.meta.score', NULL)`
      )
      expect(result.params).toEqual([])
    })
  })

  describe('buildUpdateQuery integration with null handling', () => {
    it('should generate correct UPDATE query with null values', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = {
        $set: {
          name: 'John',
          description: null,
        },
      }
      const result = await sqlBuilder.buildUpdateQuery(
        'users',
        querySelect,
        queryUpdate,
        false
      )
      expect(result.sql).toContain('UPDATE `users`')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.id' = ?")
      expect(result.values).toEqual(['John', 'test123'])
    })

    it('should generate correct UPDATE query with null in WHERE clause', async () => {
      const querySelect = { name: null }
      const queryUpdate = {
        $set: { status: 'updated' },
      }
      const result = await sqlBuilder.buildUpdateQuery(
        'users',
        querySelect,
        queryUpdate
      )
      expect(result.sql).toContain('UPDATE `users`')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain('JSON_TYPE')
      expect(result.sql).toContain('JSON_EXTRACT')
      expect(result.sql).toContain("= 'NULL'")
      expect(result.values).toEqual(['updated'])
    })

    it('should generate correct UPDATE query matching the failing scenario', async () => {
      const querySelect = { surveyId: 'survey123' }
      const queryUpdate = {
        $set: {
          'surveySnapshot.questions': null,
        },
      }
      const result = await sqlBuilder.buildUpdateQuery(
        'surveySnapshot',
        querySelect,
        queryUpdate,
        true
      )
      expect(result.sql).toContain('UPDATE `surveySnapshot`')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain('LIMIT 1')
      expect(result.sql).toContain("jdoc->>'$.surveyId' = ?")
      expect(result.values).toEqual(['survey123'])
    })
  })
})
