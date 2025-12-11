import { MysqlSqlBuilder } from './mysql-sql-builder'
import { JSON_DOCUMENT_COLUMN_NAME } from './mysql-constants'

describe('MysqlSqlBuilder - Main Orchestrator', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('buildSelectQuery', () => {
    it('should build basic SELECT query', async () => {
      const result = await sqlBuilder.buildSelectQuery('users')
      expect(result.sql).toContain('SELECT `jdoc` FROM `users`')
      expect(result.values).toEqual([])
    })

    it('should build SELECT query with WHERE clause', async () => {
      const query = { name: 'John' }
      const result = await sqlBuilder.buildSelectQuery('users', query)
      expect(result.sql).toContain('SELECT `jdoc` FROM `users`')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.name' = ?")
      expect(result.values).toEqual(['John'])
    })

    it('should build SELECT query with sorting', async () => {
      const options = { sort: { name: 1, age: -1 } }
      const result = await sqlBuilder.buildSelectQuery(
        'users',
        undefined,
        options
      )
      expect(result.sql).toContain('ORDER BY')
      expect(result.sql).toContain("jdoc->>'$.name' ASC")
      expect(result.sql).toContain("jdoc->>'$.age' DESC")
    })

    it('should build SELECT query with limit and offset', async () => {
      const options = { limit: 10, skip: 5 }
      const result = await sqlBuilder.buildSelectQuery(
        'users',
        undefined,
        options
      )
      expect(result.sql).toContain('LIMIT 10 OFFSET 5')
    })
  })

  describe('buildInsertOneQuery', () => {
    it('should build INSERT query for single object', () => {
      const obj = { name: 'John', age: 30 }
      const result = sqlBuilder.buildInsertOneQuery('users', obj)
      expect(result.sql).toContain('INSERT INTO `users` (jdoc)')
      expect(result.sql).toContain('VALUES (CAST(? AS JSON))')
      expect(result.values).toEqual([JSON.stringify(obj)])
    })
  })

  describe('buildInsertManyQuery', () => {
    it('should build INSERT query for multiple objects', () => {
      const objects = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]
      const result = sqlBuilder.buildInsertManyQuery('users', objects)
      expect(result.sql).toContain('INSERT INTO `users` (jdoc)')
      expect(result.sql).toContain(
        'VALUES (CAST(? AS JSON)), (CAST(? AS JSON))'
      )
      expect(result.values).toEqual([
        JSON.stringify(objects[0]),
        JSON.stringify(objects[1]),
      ])
    })

    it('should handle empty array', () => {
      const result = sqlBuilder.buildInsertManyQuery('users', [])
      expect(result.sql).toBe('')
      expect(result.values).toEqual([])
    })
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

  describe('buildDeleteQuery', () => {
    it('should build DELETE query with WHERE clause', async () => {
      const query = { id: 'test123' }
      const result = await sqlBuilder.buildDeleteQuery('users', query)

      expect(result.sql).toContain('DELETE FROM `users`')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.id' = ?")
      expect(result.values).toEqual(['test123'])
    })

    it('should build DELETE query with LIMIT 1 when specified', async () => {
      const query = { id: 'test123' }
      const result = await sqlBuilder.buildDeleteQuery('users', query, true)

      expect(result.sql).toContain('LIMIT 1')
    })
  })

  describe('buildCountQuery', () => {
    it('should build COUNT query without WHERE clause', async () => {
      const result = await sqlBuilder.buildCountQuery('users')
      expect(result.sql).toContain('SELECT COUNT(*)')
      expect(result.sql).toContain('FROM `users`')
      expect(result.values).toEqual([])
    })

    it('should build COUNT query with WHERE clause', async () => {
      const query = { status: 'active' }
      const result = await sqlBuilder.buildCountQuery('users', query)
      expect(result.sql).toContain('SELECT COUNT(*)')
      expect(result.sql).toContain('FROM `users`')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.status' = ?")
      expect(result.values).toEqual(['active'])
    })
  })

  describe('buildFindGroupQuery', () => {
    it('should build GROUP BY query', async () => {
      const groupFields = ['status', 'department']
      const result = await sqlBuilder.buildFindGroupQuery('users', groupFields)

      expect(result.sql).toContain('SELECT')
      expect(result.sql).toContain("jdoc->>'$.status' AS status")
      expect(result.sql).toContain("jdoc->>'$.department' AS department")
      expect(result.sql).toContain('COUNT(*) AS count')
      expect(result.sql).toContain('FROM `users`')
      expect(result.sql).toContain('GROUP BY status, department')
    })

    it('should build GROUP BY query with WHERE clause', async () => {
      const groupFields = ['status']
      const query = { age: { $gte: 18 } }
      const result = await sqlBuilder.buildFindGroupQuery(
        'users',
        groupFields,
        query
      )

      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain("jdoc->>'$.age' >= ?")
      expect(result.values).toEqual([18])
    })
  })

  describe('buildGroupCountQuery', () => {
    it('should build GROUP COUNT query', async () => {
      const groupFields = ['status']
      const result = await sqlBuilder.buildGroupCountQuery('users', groupFields)

      expect(result.sql).toContain('SELECT')
      expect(result.sql).toContain("jdoc->>'$.status' AS status")
      expect(result.sql).toContain('COUNT(*) AS count')
      expect(result.sql).toContain('GROUP BY status')
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

  describe('integration with column existence checker', () => {
    it('should delegate column optimization to WHERE builder', async () => {
      // Mock the column existence checker
      const mockChecker = jest.fn().mockResolvedValue(true)
      sqlBuilder.setColumnExistsChecker(mockChecker, 'test_table')

      const testDate = new Date('2023-01-01T12:00:00.000Z')
      const query = { created_at: { $gte: testDate } }
      const result = await sqlBuilder.buildSelectQuery('test_table', query)

      // Should use generated column optimization
      expect(result.sql).toContain('`gen_created_at` >= ?')
      expect(result.values).toEqual(['2023-01-01 12:00:00'])
    })
  })

  describe('backward compatibility', () => {
    it('should expose utility functions for backward compatibility', () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z')
      expect(sqlBuilder.dateToMysqlString(testDate)).toBe('2023-01-01 12:00:00')
      expect(sqlBuilder.stripWhitespace('  SELECT   *  FROM   users  ')).toBe(
        'SELECT * FROM users'
      )
      expect(sqlBuilder.sanitizeIdentifier('valid_name')).toBe('valid_name')
      expect(sqlBuilder.quoteIdentifier('table_name')).toBe('`table_name`')
      expect(sqlBuilder.jsonExtract('doc', "'$.field'")).toBe(
        "JSON_EXTRACT(doc, '$.field')"
      )
      expect(sqlBuilder.jsonUnquote('value')).toBe('JSON_UNQUOTE(value)')
      expect(sqlBuilder.left('column', 10)).toBe('LEFT(column, 10)')
      expect(sqlBuilder.strTodate('2023-01-01', '%Y-%m-%d')).toBe(
        "STR_TO_DATE(2023-01-01, '%Y-%m-%d')"
      )
    })

    it('should expose WHERE clause building', async () => {
      const query = { name: 'John', age: { $gt: 25 } }
      const result = await sqlBuilder.buildWhereClause(query)
      expect(result.clause).toContain("jdoc->>'$.name' = ?")
      expect(result.clause).toContain("jdoc->>'$.age' > ?")
      expect(result.params).toEqual(['John', 25])
    })

    it('should expose DDL operations', () => {
      expect(sqlBuilder.buildCreateTableQuery('users', '_id', 36)).toContain(
        'CREATE TABLE'
      )
      expect(sqlBuilder.buildDropTableQuery('users')).toContain('DROP TABLE')
      expect(sqlBuilder.buildColumnExistsQuery()).toContain(
        'information_schema.COLUMNS'
      )
      expect(sqlBuilder.buildIndexExistsQuery()).toContain(
        'information_schema.STATISTICS'
      )
      expect(sqlBuilder.buildTableExistsQuery()).toContain(
        'information_schema.TABLES'
      )
      expect(
        sqlBuilder.buildCreateColumnQuery(
          'users',
          'gen_name',
          'name',
          255,
          'utf8mb4'
        )
      ).toContain('ALTER TABLE')
      expect(
        sqlBuilder.buildCreateIndexQuery('users', 'idx_name', 'gen_name', true)
      ).toContain('CREATE UNIQUE INDEX')
      expect(sqlBuilder.buildDropIndexQuery('users', 'idx_name')).toContain(
        'DROP INDEX'
      )
      expect(sqlBuilder.buildGetIndexesQuery()).toContain('SELECT INDEX_NAME')
    })
  })
})
