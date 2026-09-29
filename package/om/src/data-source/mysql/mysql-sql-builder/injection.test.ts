import { MysqlSqlBuilder } from '../mysql-sql-builder'

describe('MysqlSqlBuilder - SQL Injection Protection', () => {
  let sqlBuilder: MysqlSqlBuilder

  beforeEach(() => {
    sqlBuilder = new MysqlSqlBuilder()
  })

  describe('buildSelectQuery - ORDER BY sanitization', () => {
    it('should accept valid field names with alphanumeric characters', async () => {
      const options = { sort: { name123: 1, field_name: -1 } }
      const result = await sqlBuilder.buildSelectQuery(
        'users',
        undefined,
        options
      )
      expect(result.sql).toContain("jdoc->>'$.name123' ASC")
      expect(result.sql).toContain("jdoc->>'$.field_name' DESC")
    })

    it('should accept valid nested field names with dots', async () => {
      const options = { sort: { 'address.city': 1, 'user.profile.age': -1 } }
      const result = await sqlBuilder.buildSelectQuery(
        'users',
        undefined,
        options
      )
      expect(result.sql).toContain("jdoc->>'$.address.city' ASC")
      expect(result.sql).toContain("jdoc->>'$.user.profile.age' DESC")
    })

    it('should reject field names with SQL injection attempts - single quote', async () => {
      const options = { sort: { "name' OR '1'='1": 1 } }
      await expect(
        sqlBuilder.buildSelectQuery('users', undefined, options)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject field names with SQL injection attempts - semicolon', async () => {
      const options = { sort: { 'name; DROP TABLE users--': 1 } }
      await expect(
        sqlBuilder.buildSelectQuery('users', undefined, options)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject field names with SQL injection attempts - backtick', async () => {
      const options = { sort: { 'name`; DELETE FROM users WHERE `1': 1 } }
      await expect(
        sqlBuilder.buildSelectQuery('users', undefined, options)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject field names with SQL injection attempts - double dash', async () => {
      const options = { sort: { 'name--comment': 1 } }
      await expect(
        sqlBuilder.buildSelectQuery('users', undefined, options)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject field names with SQL injection attempts - parentheses', async () => {
      const options = { sort: { 'name) OR (1=1': 1 } }
      await expect(
        sqlBuilder.buildSelectQuery('users', undefined, options)
      ).rejects.toThrow('Invalid JSON path key')
    })
  })

  describe('buildSetClause - $set operator sanitization', () => {
    it('should accept valid field names', () => {
      const queryUpdate = {
        $set: {
          'name': 'John',
          'age_123': 30,
          'address.city': 'NYC',
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(result.clause).toContain('$.name')
      expect(result.clause).toContain('$.age_123')
      expect(result.clause).toContain('$.address.city')
    })

    it('should reject $set field names with SQL injection - single quote', () => {
      const queryUpdate = {
        $set: {
          "name' OR '1'='1": 'malicious',
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $set field names with SQL injection - semicolon', () => {
      const queryUpdate = {
        $set: {
          'field; DROP TABLE users--': 'malicious',
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $set field names with SQL injection - backtick', () => {
      const queryUpdate = {
        $set: {
          'field`; DELETE FROM users WHERE `1': 'malicious',
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $set field names with object values and SQL injection', () => {
      const queryUpdate = {
        $set: {
          "tags'; DROP TABLE users--": ['tag1', 'tag2'],
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $set field names with null values and SQL injection', () => {
      const queryUpdate = {
        $set: {
          "name' OR '1'='1": null,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })
  })

  describe('buildSetClause - $unset operator sanitization', () => {
    it('should accept valid field names', () => {
      const queryUpdate = {
        $unset: {
          'age': true,
          'field_name': true,
          'nested.field': true,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(result.clause).toContain('$.age')
      expect(result.clause).toContain('$.field_name')
      expect(result.clause).toContain('$.nested.field')
    })

    it('should reject $unset field names with SQL injection - single quote', () => {
      const queryUpdate = {
        $unset: {
          "field' OR '1'='1": true,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $unset field names with SQL injection - semicolon', () => {
      const queryUpdate = {
        $unset: {
          'field; DROP TABLE users--': true,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })
  })

  describe('buildSetClause - $inc operator sanitization', () => {
    it('should accept valid field names', () => {
      const queryUpdate = {
        $inc: {
          'count': 1,
          'score_total': 5,
          'stats.views': 10,
        },
      }
      const result = sqlBuilder.buildSetClause(queryUpdate)
      expect(result.clause).toContain('$.count')
      expect(result.clause).toContain('$.score_total')
      expect(result.clause).toContain('$.stats.views')
    })

    it('should reject $inc field names with SQL injection - single quote', () => {
      const queryUpdate = {
        $inc: {
          "count' OR '1'='1": 1,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $inc field names with SQL injection - semicolon', () => {
      const queryUpdate = {
        $inc: {
          'score; DELETE FROM users--': 1,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })

    it('should reject $inc field names with SQL injection - comment injection', () => {
      const queryUpdate = {
        $inc: {
          'field/*malicious comment*/': 1,
        },
      }
      expect(() => sqlBuilder.buildSetClause(queryUpdate)).toThrow(
        'Invalid JSON path key'
      )
    })
  })

  describe('buildFindGroupQuery - sanitization', () => {
    it('should accept valid group field names', async () => {
      const groupFields = ['status', 'department_id', 'level_code']
      const result = await sqlBuilder.buildFindGroupQuery('users', groupFields)
      expect(result.sql).toContain("jdoc->>'$.status'")
      expect(result.sql).toContain("jdoc->>'$.department_id'")
      expect(result.sql).toContain("jdoc->>'$.level_code'")
    })

    it('should reject group field names with SQL injection - single quote', async () => {
      const groupFields = ["status' OR '1'='1"]
      await expect(
        sqlBuilder.buildFindGroupQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })

    it('should reject group field names with SQL injection - semicolon', async () => {
      const groupFields = ['status; DROP TABLE users--']
      await expect(
        sqlBuilder.buildFindGroupQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })

    it('should reject group field names with SQL injection - UNION attack', async () => {
      const groupFields = ['status UNION SELECT * FROM passwords--']
      await expect(
        sqlBuilder.buildFindGroupQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })

    it('should reject group field names with SQL injection - backtick', async () => {
      const groupFields = ['field`; DELETE FROM users WHERE `1']
      await expect(
        sqlBuilder.buildFindGroupQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })
  })

  describe('buildGroupCountQuery - sanitization', () => {
    it('should accept valid group field names', async () => {
      const groupFields = ['status', 'type_code', 'category_name']
      const result = await sqlBuilder.buildGroupCountQuery('users', groupFields)
      expect(result.sql).toContain("jdoc->>'$.status'")
      expect(result.sql).toContain("jdoc->>'$.type_code'")
      expect(result.sql).toContain("jdoc->>'$.category_name'")
    })

    it('should reject group field names with SQL injection - single quote', async () => {
      const groupFields = ["field' OR '1'='1"]
      await expect(
        sqlBuilder.buildGroupCountQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })

    it('should reject group field names with SQL injection - semicolon', async () => {
      const groupFields = ['field; DROP TABLE users--']
      await expect(
        sqlBuilder.buildGroupCountQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })

    it('should reject group field names with SQL injection - hex encoding attack', async () => {
      const groupFields = ['field\\x27OR\\x271\\x27=\\x271']
      await expect(
        sqlBuilder.buildGroupCountQuery('users', groupFields)
      ).rejects.toThrow('Invalid')
    })
  })

  describe('buildUpdateQuery - integration test for sanitization', () => {
    it('should reject malicious field names in update operations', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = {
        $set: {
          "name'; DROP TABLE users--": 'malicious',
        },
      }
      await expect(
        sqlBuilder.buildUpdateQuery('users', querySelect, queryUpdate)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject malicious field names in $inc operations', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = {
        $inc: {
          "count' OR '1'='1": 1,
        },
      }
      await expect(
        sqlBuilder.buildUpdateQuery('users', querySelect, queryUpdate)
      ).rejects.toThrow('Invalid JSON path key')
    })

    it('should reject malicious field names in $unset operations', async () => {
      const querySelect = { id: 'test123' }
      const queryUpdate = {
        $unset: {
          'field; DELETE FROM users WHERE 1=1--': true,
        },
      }
      await expect(
        sqlBuilder.buildUpdateQuery('users', querySelect, queryUpdate)
      ).rejects.toThrow('Invalid JSON path key')
    })
  })
})
