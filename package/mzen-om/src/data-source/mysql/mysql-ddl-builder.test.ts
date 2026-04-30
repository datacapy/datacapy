import { MysqlDdlBuilder } from './mysql-ddl-builder'
import { stripWhitespace } from './mysql-sql-utils'

describe('MysqlDdlBuilder', () => {
  let ddlBuilder: MysqlDdlBuilder

  beforeEach(() => {
    ddlBuilder = new MysqlDdlBuilder()
  })

  describe('buildCreateTableQuery', () => {
    it('should generate a valid CREATE TABLE query', () => {
      const result = ddlBuilder.buildCreateTableQuery('users', '_id', 36)
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('CREATE TABLE `users`')
      expect(stripped).toContain('gen__id VARCHAR(36)')
      expect(stripped).toContain('PRIMARY KEY')
      expect(stripped).toContain('jdoc JSON')
    })
  })

  describe('buildDropTableQuery', () => {
    it('should generate a valid DROP TABLE query', () => {
      const result = ddlBuilder.buildDropTableQuery('users')
      const stripped = stripWhitespace(result)
      expect(stripped).toBe('DROP TABLE IF EXISTS `users`')
    })
  })

  describe('buildColumnExistsQuery', () => {
    it('should generate a valid column exists query', () => {
      const result = ddlBuilder.buildColumnExistsQuery()
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('SELECT COUNT(*) as count')
      expect(stripped).toContain('FROM information_schema.COLUMNS')
      expect(stripped).toContain(
        'WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = DATABASE()'
      )
    })
  })

  describe('buildIndexExistsQuery', () => {
    it('should generate a valid index exists query', () => {
      const result = ddlBuilder.buildIndexExistsQuery()
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('SELECT COUNT(*) as count')
      expect(stripped).toContain('FROM information_schema.STATISTICS')
      expect(stripped).toContain(
        'WHERE TABLE_NAME = ? AND INDEX_NAME = ? AND TABLE_SCHEMA = DATABASE()'
      )
    })
  })

  describe('buildTableExistsQuery', () => {
    it('should generate a valid table exists query', () => {
      const result = ddlBuilder.buildTableExistsQuery()
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('SELECT COUNT(*) as count')
      expect(stripped).toContain('FROM information_schema.TABLES')
      expect(stripped).toContain(
        'WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()'
      )
    })
  })

  describe('buildCreateColumnQuery', () => {
    it('should generate a valid create column query for string type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_email',
        'email',
        255,
        'CHARACTER SET utf8mb4',
        'string'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `users`')
      expect(stripped).toContain('ADD COLUMN `gen_email`')
      expect(stripped).toContain('VARCHAR(255) CHARACTER SET utf8mb4')
      expect(stripped).toContain('GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.email')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for int type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_age',
        'age',
        0,
        '',
        'int'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `users`')
      expect(stripped).toContain('ADD COLUMN `gen_age`')
      expect(stripped).toContain('INT GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.age')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for bigintUnsigned type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'ip_country_v4',
        'gen_ip_from',
        'ip_from',
        0,
        '',
        'bigintUnsigned'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `ip_country_v4`')
      expect(stripped).toContain('ADD COLUMN `gen_ip_from`')
      expect(stripped).toContain('BIGINT UNSIGNED GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.ip_from')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for decimal type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'products',
        'gen_price',
        'price',
        0,
        '',
        'decimal'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `products`')
      expect(stripped).toContain('ADD COLUMN `gen_price`')
      expect(stripped).toContain('DECIMAL(14,2) GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.price')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for date type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'events',
        'gen_date',
        'date',
        0,
        '',
        'date'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `events`')
      expect(stripped).toContain('ADD COLUMN `gen_date`')
      expect(stripped).toContain('DATE GENERATED ALWAYS')
      expect(stripped).toContain(
        "STR_TO_DATE(LEFT(JSON_VALUE(jdoc, '$.date'), 10), '%Y-%m-%d')"
      )
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for datetime type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'logs',
        'gen_timestamp',
        'timestamp',
        0,
        '',
        'datetime'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `logs`')
      expect(stripped).toContain('ADD COLUMN `gen_timestamp`')
      expect(stripped).toContain('DATETIME GENERATED ALWAYS')
      expect(stripped).toContain(
        "STR_TO_DATE(LEFT(JSON_VALUE(jdoc, '$.timestamp'), 19), '%Y-%m-%dT%H:%i:%s')"
      )
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for timestamp type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'logs',
        'gen_created_at',
        'created_at',
        0,
        '',
        'timestamp'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `logs`')
      expect(stripped).toContain('ADD COLUMN `gen_created_at`')
      expect(stripped).toContain('TIMESTAMP(3) GENERATED ALWAYS')
      expect(stripped).toContain(
        "STR_TO_DATE(LEFT(JSON_VALUE(jdoc, '$.created_at'), 19), '%Y-%m-%dT%H:%i:%s')"
      )
      expect(stripped).toContain('STORED')
    })

    it('should default to string type when no type hint is provided', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_name',
        'name',
        100,
        'CHARACTER SET utf8mb4'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `users`')
      expect(stripped).toContain('ADD COLUMN `gen_name`')
      expect(stripped).toContain('VARCHAR(100) CHARACTER SET utf8mb4')
      expect(stripped).toContain('GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.name')")
      expect(stripped).toContain('STORED')
    })

    it('should wrap extract expression with LOWER() when lowercase is true', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_email_lower',
        'email',
        255,
        '',
        'string',
        true
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ADD COLUMN `gen_email_lower`')
      expect(stripped).toContain("LOWER(JSON_VALUE(jdoc, '$.email'))")
      expect(stripped).toContain('STORED')
    })

    it('should not wrap with LOWER() when lowercase is false', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_email',
        'email',
        255,
        '',
        'string',
        false
      )
      const stripped = stripWhitespace(result)
      expect(stripped).not.toContain('LOWER(')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.email')")
    })
  })

  describe('buildCreateIndexQuery', () => {
    it('should generate a valid create index query', () => {
      const result = ddlBuilder.buildCreateIndexQuery(
        'users',
        'idx_email',
        'gen_email',
        true
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toBe(
        'CREATE UNIQUE INDEX `idx_email` ON `users` (gen_email)'
      )
    })

    it('should generate a non-unique index query when isUnique is false', () => {
      const result = ddlBuilder.buildCreateIndexQuery(
        'users',
        'idx_name',
        'gen_name',
        false
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toBe('CREATE INDEX `idx_name` ON `users` (gen_name)')
    })
  })

  describe('buildDropIndexQuery', () => {
    it('should generate a valid drop index query', () => {
      const result = ddlBuilder.buildDropIndexQuery('users', 'idx_email')
      const stripped = stripWhitespace(result)
      expect(stripped).toBe('DROP INDEX `idx_email` ON `users`')
    })
  })

  describe('buildGetIndexesQuery', () => {
    it('should generate a valid get indexes query', () => {
      const result = ddlBuilder.buildGetIndexesQuery()
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('SELECT INDEX_NAME')
      expect(stripped).toContain('FROM information_schema.STATISTICS')
      expect(stripped).toContain(
        "WHERE TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' AND TABLE_SCHEMA = DATABASE()"
      )
    })
  })

  describe('buildCreateColumnQuery - nested JSON paths', () => {
    it('should generate a valid create column query for nested field', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_address_city',
        'address.city',
        255,
        'CHARACTER SET utf8mb4',
        'string'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `users`')
      expect(stripped).toContain('ADD COLUMN `gen_address_city`')
      expect(stripped).toContain('VARCHAR(255) CHARACTER SET utf8mb4')
      expect(stripped).toContain('GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.address.city')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for deeply nested field', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'products',
        'gen_meta_pricing_discount_amount',
        'meta.pricing.discount.amount',
        0,
        '',
        'decimal'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `products`')
      expect(stripped).toContain(
        'ADD COLUMN `gen_meta_pricing_discount_amount`'
      )
      expect(stripped).toContain('DECIMAL(14,2) GENERATED ALWAYS')
      expect(stripped).toContain(
        "JSON_VALUE(jdoc, '$.meta.pricing.discount.amount')"
      )
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for nested field with int type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'users',
        'gen_profile_age',
        'profile.age',
        0,
        '',
        'int'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `users`')
      expect(stripped).toContain('ADD COLUMN `gen_profile_age`')
      expect(stripped).toContain('INT GENERATED ALWAYS')
      expect(stripped).toContain("JSON_VALUE(jdoc, '$.profile.age')")
      expect(stripped).toContain('STORED')
    })

    it('should generate a valid create column query for nested field with date type', () => {
      const result = ddlBuilder.buildCreateColumnQuery(
        'events',
        'gen_schedule_start_date',
        'schedule.start.date',
        0,
        '',
        'date'
      )
      const stripped = stripWhitespace(result)
      expect(stripped).toContain('ALTER TABLE `events`')
      expect(stripped).toContain('ADD COLUMN `gen_schedule_start_date`')
      expect(stripped).toContain('DATE GENERATED ALWAYS')
      expect(stripped).toContain(
        "STR_TO_DATE(LEFT(JSON_VALUE(jdoc, '$.schedule.start.date'), 10), '%Y-%m-%d')"
      )
      expect(stripped).toContain('STORED')
    })
  })
})
