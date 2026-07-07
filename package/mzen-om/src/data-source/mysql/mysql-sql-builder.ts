// cspell:ignore ARRAYAGG elem
import {
  QuerySelection,
  QuerySelectionOptions,
  QueryUpdate,
  TypeHintValue,
} from '../interface'

import { JSON_DOCUMENT_COLUMN_NAME } from './mysql-constants'

import {
  convertValue,
  sanitizeIdentifier,
  sanitizeJsonPathKey,
  stripWhitespace,
} from './mysql-sql-utils'

import { MysqlWhereBuilder, ColumnExistsChecker } from './mysql-where-builder'

import { MysqlDdlBuilder } from './mysql-ddl-builder'

/**
 * Main SQL builder class that orchestrates different builder modules
 */
export class MysqlSqlBuilder {
  private whereBuilder = new MysqlWhereBuilder()
  private ddlBuilder = new MysqlDdlBuilder()

  setColumnExistsChecker(checker: ColumnExistsChecker, tableName: string) {
    this.whereBuilder.setColumnExistsChecker(checker, tableName)
  }

  async buildSelectQuery(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)
    const sanitizedColumnName = sanitizeIdentifier(
      JSON_DOCUMENT_COLUMN_NAME,
      true
    )

    let whereClause = ''
    const values: any[] = []

    if (query) {
      const { clause, params } = await this.whereBuilder.buildWhereClause(query)
      if (clause) {
        // Check if clause is not empty
        whereClause = `WHERE ${clause}`
        values.push(...params)
      }
    }

    let orderByClause = ''
    if (options?.sort) {
      const sortFields = Object.entries(options.sort)
        .map(
          ([field, order]) =>
            `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${sanitizeJsonPathKey(field)}'` +
            ` ${order === 1 ? 'ASC' : 'DESC'}`
        )
        .join(', ')
      orderByClause = `ORDER BY ${sortFields}`
    }

    let limitClause = ''
    if (options?.limit || options?.skip) {
      const limit = options.limit ?? Number.MAX_SAFE_INTEGER
      limitClause = `LIMIT ${limit}`
      if (options.skip) {
        limitClause += ` OFFSET ${options.skip}`
      }
    }

    const sql = stripWhitespace(`
      SELECT ${sanitizedColumnName}
      FROM ${sanitizedTableName}
      ${whereClause} ${orderByClause} ${limitClause}
    `)

    return { sql, values }
  }

  buildInsertOneQuery<Type>(tableName: string, object: Type) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)
    const sql = stripWhitespace(`
      INSERT INTO
      ${sanitizedTableName} (${JSON_DOCUMENT_COLUMN_NAME})
      VALUES (CAST(? AS JSON))
    `)
    const values = [JSON.stringify(object)]
    return { sql, values }
  }

  async buildUpdateQuery(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    limitOne: boolean = false
  ) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)

    const { clause, params: whereParams } =
      await this.whereBuilder.buildWhereClause(querySelect)
    const whereClause = clause ? `WHERE ${clause}` : ''
    const { clause: setClause, params: setParams } =
      this.buildSetClause(queryUpdate)

    const sql = stripWhitespace(`
      UPDATE ${sanitizedTableName}
      SET ${setClause}
      ${whereClause}
      ${limitOne ? 'LIMIT 1' : ''}
    `)

    const values = [...setParams, ...whereParams]
    return { sql, values }
  }

  buildSetClause(queryUpdate: QueryUpdate): {
    clause: string
    params: any[]
  } {
    const setClauses: string[] = []
    const params: any[] = []

    const supportedOperators = [
      '$set',
      '$setOnInsert',
      '$unset',
      '$inc',
      '$push',
      '$addToSet',
      '$pop',
      '$pull',
      '$pullAll',
      '$rename',
    ]

    for (const [key, value] of Object.entries(queryUpdate)) {
      if (!supportedOperators.includes(key)) {
        throw new Error(
          `Unsupported operator: ${key}. Supported operators: ${supportedOperators.join(', ')}.`
        )
      }

      if (key === '$set') {
        for (const [field, fieldValue] of Object.entries(value as object)) {
          if (typeof fieldValue === 'object' && fieldValue !== null) {
            // Handle array of primitives
            setClauses.push(
              stripWhitespace(`
                ${JSON_DOCUMENT_COLUMN_NAME} =
                  JSON_SET(${JSON_DOCUMENT_COLUMN_NAME},
                  '$.${sanitizeJsonPathKey(field)}',
                  CAST(? AS JSON))
              `)
            )
            params.push(JSON.stringify(fieldValue))
          } else if (fieldValue === null) {
            // Handle null values - inject NULL directly to avoid string conversion
            setClauses.push(
              stripWhitespace(`
                ${JSON_DOCUMENT_COLUMN_NAME} =
                  JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizeJsonPathKey(field)}', NULL)
              `)
            )
          } else {
            // Handle primitive values
            setClauses.push(
              stripWhitespace(`
                ${JSON_DOCUMENT_COLUMN_NAME} =
                  JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizeJsonPathKey(field)}', ?)
              `)
            )
            params.push(fieldValue)
          }
        }
      } else if (key === '$unset') {
        const unsetFields = Object.keys(value as object)
        unsetFields.forEach((field) => {
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizeJsonPathKey(field)}')
            `)
          )
        })
      } else if (key === '$inc') {
        for (const [field, increment] of Object.entries(value as object)) {
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
               JSON_SET(${JSON_DOCUMENT_COLUMN_NAME},
                '$.${sanitizeJsonPathKey(field)}',
                COALESCE(${JSON_DOCUMENT_COLUMN_NAME}->>'$.${sanitizeJsonPathKey(field)}', 0) + ?)
            `)
          )
          params.push(increment)
        }
      } else if (key === '$push') {
        for (const [field, fieldValue] of Object.entries(value as object)) {
          const path = `'$.${sanitizeJsonPathKey(field)}'`
          const currentArray = `COALESCE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${path}), JSON_ARRAY())`
          const isEach =
            typeof fieldValue === 'object' &&
            fieldValue !== null &&
            !Array.isArray(fieldValue) &&
            '$each' in fieldValue
          const items: any[] = isEach ? fieldValue.$each : [fieldValue]
          const appendArgs = items
            .map((item) => {
              const isObject = typeof item === 'object' && item !== null
              return `'$', ${isObject ? 'CAST(? AS JSON)' : '?'}`
            })
            .join(', ')
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, ${path},
                  JSON_ARRAY_APPEND(${currentArray}, ${appendArgs}))
            `)
          )
          for (const item of items) {
            if (typeof item === 'object' && item !== null) {
              params.push(JSON.stringify(item))
            } else {
              params.push(item)
            }
          }
        }
      } else if (key === '$addToSet') {
        for (const [field, fieldValue] of Object.entries(value as object)) {
          const path = `'$.${sanitizeJsonPathKey(field)}'`
          const currentArray = `COALESCE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${path}), JSON_ARRAY())`
          const isEach =
            typeof fieldValue === 'object' &&
            fieldValue !== null &&
            !Array.isArray(fieldValue) &&
            '$each' in fieldValue
          const items: any[] = isEach ? fieldValue.$each : [fieldValue]
          // Build nested IF expressions: each element only appended when not already contained
          // innermost starts with currentArray and wraps outward
          let expr = currentArray
          for (const item of items) {
            const isObject = typeof item === 'object' && item !== null
            // JSON_CONTAINS check param is always JSON-encoded; append uses CAST for objects
            const appendPlaceholder = isObject ? `CAST(? AS JSON)` : `?`
            expr = stripWhitespace(`
              IF(
                JSON_CONTAINS(${currentArray}, CAST(? AS JSON)),
                ${currentArray},
                JSON_ARRAY_APPEND(${expr}, '$', ${appendPlaceholder})
              )
            `)
            params.push(JSON.stringify(item))
            if (isObject) {
              params.push(JSON.stringify(item))
            } else {
              params.push(item)
            }
          }
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, ${path}, ${expr})
            `)
          )
        }
      } else if (key === '$pop') {
        for (const [field, direction] of Object.entries(value as object)) {
          if (direction !== 1 && direction !== -1) {
            throw new Error(
              `$pop value for field "${field}" must be 1 (remove last) or -1 (remove first).`
            )
          }
          const path = `'$.${sanitizeJsonPathKey(field)}'`
          const len = `JSON_LENGTH(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${path}))`
          const removeExpr =
            direction === 1
              ? stripWhitespace(`
                  JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME},
                    CONCAT('$.${sanitizeJsonPathKey(field)}[', ${len} - 1, ']'))
                `)
              : stripWhitespace(`
                  JSON_REMOVE(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizeJsonPathKey(field)}[0]')
                `)
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                IF(${len} > 0, ${removeExpr}, ${JSON_DOCUMENT_COLUMN_NAME})
            `)
          )
        }
      } else if (key === '$pull') {
        for (const [field, matchValue] of Object.entries(value as object)) {
          if (
            typeof matchValue === 'object' &&
            matchValue !== null &&
            !Array.isArray(matchValue)
          ) {
            throw new Error(
              `$pull with a query predicate is not supported for field "${field}". ` +
                `Only scalar values are supported.`
            )
          }
          const path = `'$.${sanitizeJsonPathKey(field)}'`
          const currentArray = `COALESCE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${path}), JSON_ARRAY())`
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, ${path},
                  COALESCE((
                    SELECT JSON_ARRAYAGG(elem)
                    FROM JSON_TABLE(${currentArray}, '$[*]' COLUMNS(elem JSON PATH '$')) t
                    WHERE NOT JSON_CONTAINS(elem, CAST(? AS JSON))
                  ), JSON_ARRAY()))
            `)
          )
          params.push(JSON.stringify(matchValue))
        }
      } else if (key === '$pullAll') {
        for (const [field, matchValues] of Object.entries(value as object)) {
          if (!Array.isArray(matchValues)) {
            throw new Error(
              `$pullAll value for field "${field}" must be an array.`
            )
          }
          const path = `'$.${sanitizeJsonPathKey(field)}'`
          const currentArray = `COALESCE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${path}), JSON_ARRAY())`
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, ${path},
                  COALESCE((
                    SELECT JSON_ARRAYAGG(elem)
                    FROM JSON_TABLE(${currentArray}, '$[*]' COLUMNS(elem JSON PATH '$')) t
                    WHERE NOT (elem MEMBER OF (CAST(? AS JSON)))
                  ), JSON_ARRAY()))
            `)
          )
          params.push(JSON.stringify(matchValues))
        }
      } else if (key === '$rename') {
        for (const [oldField, newField] of Object.entries(
          value as Record<string, string>
        )) {
          const oldPath = `'$.${sanitizeJsonPathKey(oldField)}'`
          const newPath = `'$.${sanitizeJsonPathKey(newField)}'`
          setClauses.push(
            stripWhitespace(`
              ${JSON_DOCUMENT_COLUMN_NAME} =
                IF(
                  JSON_CONTAINS_PATH(${JSON_DOCUMENT_COLUMN_NAME}, 'one', ${oldPath}),
                  JSON_REMOVE(
                    JSON_SET(${JSON_DOCUMENT_COLUMN_NAME}, ${newPath},
                      JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, ${oldPath})),
                    ${oldPath}),
                  ${JSON_DOCUMENT_COLUMN_NAME})
            `)
          )
        }
      }
    }

    return {
      clause: setClauses.join(', '),
      params,
    }
  }

  async buildDeleteQuery(
    tableName: string,
    query: QuerySelection,
    limitOne: boolean = false
  ) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)

    const { clause: whereClause, params } =
      await this.whereBuilder.buildWhereClause(query)

    const sql = stripWhitespace(`
      DELETE FROM ${sanitizedTableName}
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ${limitOne ? 'LIMIT 1' : ''}
    `)

    return { sql, values: params }
  }

  async buildFindGroupQuery(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)
    const sanitizedGroupFields = groupFields.map((value) =>
      sanitizeIdentifier(value)
    )

    let whereClause = ''
    const values: any[] = []

    if (query) {
      const { clause, params } = await this.whereBuilder.buildWhereClause(query)
      whereClause = clause ? `WHERE ${clause}` : ''
      values.push(...params)
    }

    const groupFieldsStr = sanitizedGroupFields.join(', ')
    const selectFields = sanitizedGroupFields
      .map(
        (field) =>
          `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${sanitizeJsonPathKey(field)}' AS ${field}`
      )
      .join(', ')

    const sql = stripWhitespace(`
      SELECT
        ${selectFields},
        COUNT(*) AS count
      FROM ${sanitizedTableName}
      ${whereClause}
      GROUP BY ${groupFieldsStr}
    `)

    return { sql, values }
  }

  async buildGroupCountQuery(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)
    const sanitizedGroupFields = groupFields.map((value) =>
      sanitizeIdentifier(value)
    )

    let whereClause = ''
    const values: any[] = []

    if (query) {
      const { clause, params } = await this.whereBuilder.buildWhereClause(query)
      if (clause != '') {
        whereClause = clause ? `WHERE ${clause}` : ''
        values.push(...params)
      }
    }

    const groupFieldsStr = sanitizedGroupFields.join(', ')
    const selectFields = sanitizedGroupFields
      .map(
        (field) =>
          `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${sanitizeJsonPathKey(field)}' AS ${field}`
      )
      .join(', ')

    const sql = stripWhitespace(`
      SELECT
        ${selectFields},
        COUNT(*) AS count
      FROM ${sanitizedTableName}
      ${whereClause}
      GROUP BY ${groupFieldsStr}
    `)

    return { sql, values }
  }

  buildInsertManyQuery<Type>(tableName: string, objects: Type[]) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)

    if (objects.length === 0) {
      return { sql: '', values: [] }
    }

    const placeholders = objects.map(() => `(CAST(? AS JSON))`).join(', ')
    const values = objects.map((obj) => JSON.stringify(obj))

    const sql = stripWhitespace(`
      INSERT INTO
        ${sanitizedTableName}
        (${JSON_DOCUMENT_COLUMN_NAME})
        VALUES ${placeholders}
    `)

    return { sql, values }
  }

  async buildCountQuery(tableName: string, query?: QuerySelection) {
    const sanitizedTableName = sanitizeIdentifier(tableName, true)

    let whereClause = ''
    const values: any[] = []

    if (query) {
      const { clause, params } = await this.whereBuilder.buildWhereClause(query)
      whereClause = clause ? `WHERE ${clause}` : ''
      values.push(...params)
    }

    const sql = stripWhitespace(`
      SELECT COUNT(*) as count
      FROM ${sanitizedTableName} ${whereClause}
    `)

    return { sql, values }
  }

  // DDL (Data Definition Language) operations - delegate to DDL builder
  buildCreateTableQuery(
    tableName: string,
    idProp: string,
    idSize: number
  ): string {
    return this.ddlBuilder.buildCreateTableQuery(tableName, idProp, idSize)
  }

  buildDropTableQuery(tableName: string): string {
    return this.ddlBuilder.buildDropTableQuery(tableName)
  }

  buildColumnExistsQuery(): string {
    return this.ddlBuilder.buildColumnExistsQuery()
  }

  buildIndexExistsQuery(): string {
    return this.ddlBuilder.buildIndexExistsQuery()
  }

  buildTableExistsQuery(): string {
    return this.ddlBuilder.buildTableExistsQuery()
  }

  buildCreateColumnQuery(
    tableName: string,
    columnName: string,
    field: string,
    size: number,
    collation: string,
    typeHint?: TypeHintValue,
    lowercase?: boolean
  ): string {
    return this.ddlBuilder.buildCreateColumnQuery(
      tableName,
      columnName,
      field,
      size,
      collation,
      typeHint,
      lowercase
    )
  }

  buildCreateIndexQuery(
    tableName: string,
    indexName: string,
    columnsSql: string,
    isUnique: boolean
  ): string {
    return this.ddlBuilder.buildCreateIndexQuery(
      tableName,
      indexName,
      columnsSql,
      isUnique
    )
  }

  buildDropIndexQuery(tableName: string, indexName: string): string {
    return this.ddlBuilder.buildDropIndexQuery(tableName, indexName)
  }

  buildGetIndexesQuery(): string {
    return this.ddlBuilder.buildGetIndexesQuery()
  }

  // Expose WHERE clause building for tests and direct usage
  async buildWhereClause(query: QuerySelection): Promise<{
    clause: string
    params: any[]
  }> {
    return this.whereBuilder.buildWhereClause(query)
  }

  // Backward compatibility - expose utility functions
  dateToMysqlString(date: Date): string {
    return convertValue(date)
  }

  stripWhitespace(sql: string): string {
    return stripWhitespace(sql)
  }

  sanitizeIdentifier(identifier: string, quote = false): string {
    return sanitizeIdentifier(identifier, quote)
  }

  quoteIdentifier(identifier: string): string {
    return '`' + identifier + '`'
  }

  jsonExtract(doc: string, path: string): string {
    return `JSON_EXTRACT(${doc}, ${path})`
  }

  jsonUnquote(sql: string): string {
    return `JSON_UNQUOTE(${sql})`
  }

  left(sql: string, length: number): string {
    return `LEFT(${sql}, ${length})`
  }

  strTodate(date: string, format: string): string {
    return `STR_TO_DATE(${date}, '${format}')`
  }

  // Expose convert method for tests
  private convert(value: any): any {
    return convertValue(value)
  }
}
