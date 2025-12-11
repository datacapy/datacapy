import {
  JSON_DOCUMENT_COLUMN_NAME,
  GENERATED_COLUMN_PREFIX,
} from './mysql-constants'
import {
  sanitizeIdentifier,
  stripWhitespace,
  jsonValue,
  jsonExtract,
  jsonUnquote,
  left,
  strToDate,
} from './mysql-sql-utils'

/**
 * DDL (Data Definition Language) operations for MySQL
 * Handles CREATE/DROP operations for tables, columns, and indexes
 */
export class MysqlDdlBuilder {
  /**
   * Builds CREATE TABLE SQL
   */
  buildCreateTableQuery(
    tableName: string,
    idProp: string,
    idSize: number
  ): string {
    return stripWhitespace(`
      CREATE TABLE ${sanitizeIdentifier(tableName, true)}
        (
          ${GENERATED_COLUMN_PREFIX + idProp} VARCHAR(${idSize})
          CHARACTER SET ascii GENERATED ALWAYS
          AS (${jsonUnquote(
            jsonExtract(JSON_DOCUMENT_COLUMN_NAME, `'$.${idProp}'`)
          )}) STORED PRIMARY KEY,
          ${JSON_DOCUMENT_COLUMN_NAME} JSON
        )
    `)
  }

  /**
   * Builds DROP TABLE SQL
   */
  buildDropTableQuery(tableName: string): string {
    return `DROP TABLE IF EXISTS ${sanitizeIdentifier(tableName, true)}`
  }

  /**
   * Builds query to check if a column exists
   */
  buildColumnExistsQuery(): string {
    return stripWhitespace(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE
        TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND TABLE_SCHEMA = DATABASE()
    `)
  }

  /**
   * Builds query to check if an index exists
   */
  buildIndexExistsQuery(): string {
    return stripWhitespace(`
      SELECT COUNT(*) as count
      FROM information_schema.STATISTICS
      WHERE
        TABLE_NAME = ?
        AND INDEX_NAME = ?
        AND TABLE_SCHEMA = DATABASE()
    `)
  }

  /**
   * Builds query to check if a table exists
   */
  buildTableExistsQuery(): string {
    return stripWhitespace(`
      SELECT COUNT(*) as count
      FROM information_schema.TABLES
      WHERE TABLE_NAME = ?
      AND TABLE_SCHEMA = DATABASE()
    `)
  }

  /**
   * Builds ADD COLUMN SQL for generated columns
   */
  buildCreateColumnQuery(
    tableName: string,
    columnName: string,
    field: string,
    size: number,
    collation: string,
    typeHint?: 'string' | 'int' | 'decimal' | 'date' | 'datetime' | 'timestamp'
  ): string {
    let columnType: string
    let extractFunction: string

    let jsonValueFunc = jsonValue(JSON_DOCUMENT_COLUMN_NAME, `'$.${field}'`)

    switch (typeHint) {
      case 'int':
        columnType = 'INT'
        extractFunction = jsonValueFunc
        break
      case 'decimal':
        columnType = 'DECIMAL(14,2)'
        extractFunction = jsonValueFunc
        break
      case 'date':
        columnType = 'DATE'
        extractFunction = strToDate(left(jsonValueFunc, 10), '%Y-%m-%d')
        break
      case 'datetime':
        columnType = 'DATETIME'
        extractFunction = strToDate(
          left(jsonValueFunc, 19),
          '%Y-%m-%dT%H:%i:%s'
        )
        break
      case 'timestamp':
        columnType = 'TIMESTAMP(3)'
        extractFunction = strToDate(
          left(jsonValueFunc, 19),
          '%Y-%m-%dT%H:%i:%s'
        )
        break
      case 'string':
      default:
        columnType = `VARCHAR(${size}) ${collation}`
        extractFunction = jsonValueFunc
    }

    return stripWhitespace(`
      ALTER TABLE ${sanitizeIdentifier(tableName, true)}
        ADD COLUMN ${sanitizeIdentifier(columnName, true)}
        ${columnType} GENERATED ALWAYS
        AS (${extractFunction}) STORED
    `)
  }

  /**
   * Builds CREATE INDEX SQL
   */
  buildCreateIndexQuery(
    tableName: string,
    indexName: string,
    columnsSql: string,
    isUnique: boolean
  ): string {
    return stripWhitespace(`
      CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX ${sanitizeIdentifier(indexName, true)}
      ON ${sanitizeIdentifier(tableName, true)} (${columnsSql})
    `)
  }

  /**
   * Builds DROP INDEX SQL
   */
  buildDropIndexQuery(tableName: string, indexName: string): string {
    return stripWhitespace(`
      DROP INDEX ${sanitizeIdentifier(indexName, true)}
      ON ${sanitizeIdentifier(tableName, true)}
    `)
  }

  /**
   * Builds query to get all indexes for a table
   */
  buildGetIndexesQuery(): string {
    return stripWhitespace(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE
        TABLE_NAME = ?
        AND INDEX_NAME != 'PRIMARY'
        AND TABLE_SCHEMA = DATABASE()
    `)
  }
}
