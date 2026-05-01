import { createPool, Pool, PoolOptions, PoolConnection } from 'mysql2/promise'

import {
  DataSourceInterface,
  QuerySelection,
  QuerySelectionOptions,
  QueryUpdate,
  IndexSpec,
  IndexOptions,
  QueryPersistResult,
  QueryPersistResultInsertMany,
  QueryPersistResultInsertOne,
} from './interface'
import {
  JSON_DOCUMENT_COLUMN_NAME,
  GENERATED_COLUMN_PREFIX,
  GENERATED_COLUMN_LOWERCASE_SUFFIX,
  JDOC_ID_PROP,
  JDOC_ID_SIZE,
  COLUMN_SIZE_DEFAULT,
} from './mysql/mysql-constants'
import { MysqlSqlBuilder } from './mysql/mysql-sql-builder'
import { ObjectPathAccessor } from 'mzen-schema'

export interface DataSourceMysqlConfig extends PoolOptions {
  // Add any additional MySQL-specific configuration options here
}

export class DataSourceMysql implements DataSourceInterface {
  private pool: Pool
  private config: DataSourceMysqlConfig
  private sqlBuilder: MysqlSqlBuilder
  private columnExistsCache: Map<string, boolean> = new Map()
  private indexExistsCache: Map<string, boolean> = new Map()
  private tableExistsCache: Map<string, boolean> = new Map()
  private connection: PoolConnection | null = null

  constructor(config: DataSourceMysqlConfig) {
    this.config = config
    this.pool = createPool(this.config)
    this.sqlBuilder = new MysqlSqlBuilder()
  }

  async connect(): Promise<DataSourceInterface> {
    // Connection is automatically established when using mysql2 with createPool
    return this
  }

  async createDatabase(
    databaseName: string,
    options?: {
      charset?: string
      collate?: string
      ifNotExists?: boolean
    }
  ): Promise<void> {
    const charset = options?.charset || 'utf8mb4'
    const collate = options?.collate || 'utf8mb4_unicode_ci'
    const ifNotExists = options?.ifNotExists !== false // default true

    const sql = `CREATE DATABASE ${ifNotExists ? 'IF NOT EXISTS ' : ''}\`${databaseName}\`
      CHARACTER SET ${charset}
      COLLATE ${collate}`

    await this.query(sql)
  }

  async dropDatabase(
    databaseName: string,
    options?: { ifExists?: boolean }
  ): Promise<void> {
    const ifExists = options?.ifExists !== false // default true
    const sql = `DROP DATABASE ${ifExists ? 'IF EXISTS ' : ''}\`${databaseName}\``
    await this.query(sql)
  }

  async execute(sql: string, values?: any[]): Promise<any> {
    return this.query(sql, values)
  }

  async find<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type[]> {
    if (!(await this.tableExists(tableName))) {
      return []
    }
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildSelectQuery(
      tableName,
      query,
      options
    )

    const [rows] = await this.query(sql, values)
    let result = rows.map((row) => row[JSON_DOCUMENT_COLUMN_NAME]) as Type[]

    // Apply field filtering if options.fields is provided
    if (options?.fields) {
      result = result.map((row) => this.filterFields(row, options.fields))
    }

    return result
  }

  async findOne<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type | null> {
    if (!(await this.tableExists(tableName))) {
      return null
    }
    const results = await this.find<Type>(tableName, query, {
      ...options,
      limit: 1,
    })

    if (results.length === 0) {
      return null
    }

    let result = results[0]
    return result
  }

  async count(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    if (!(await this.tableExists(tableName))) {
      return 0
    }
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildCountQuery(
      tableName,
      query
    )
    const [rows] = await this.query(sql, values)
    return rows[0]?.count || 0
  }

  async insertMany<Type>(
    tableName: string,
    objects: Type[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    if (!(await this.tableExists(tableName))) {
      await this.createTable(tableName)
    }

    const { sql, values } = this.sqlBuilder.buildInsertManyQuery(
      tableName,
      objects
    )

    const [result]: [{ affectedRows: number; insertId: number }] =
      await this.query(sql, values)
    return {
      count: result.affectedRows,
      ids: result.insertId
        ? Array.from(
            { length: result.affectedRows },
            (_, i) => result.insertId + i
          )
        : [],
    }
  }

  async insertOne<Type>(
    tableName: string,
    object: Type,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    if (!(await this.tableExists(tableName))) {
      await this.createTable(tableName)
    }

    const { sql, values } = this.sqlBuilder.buildInsertOneQuery(
      tableName,
      object
    )

    const [result]: [{ affectedRows: number; insertId: number }] =
      await this.query(sql, values)
    return {
      count: result.affectedRows,
      id: result.insertId,
    }
  }

  async updateMany(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.tableExists(tableName))) {
      return { count: 0 }
    }
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildUpdateQuery(
      tableName,
      querySelect,
      queryUpdate
    )
    const [result]: [{ affectedRows: number }] = await this.query(sql, values)
    return { count: result.affectedRows }
  }

  async updateOne(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options: any
  ): Promise<QueryPersistResult> {
    if (!(await this.tableExists(tableName))) {
      return { count: 0 }
    }

    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildUpdateQuery(
      tableName,
      querySelect,
      queryUpdate,
      true
    )
    const [result]: [{ affectedRows: number }] = await this.query(sql, values)
    return { count: result.affectedRows }
  }

  async deleteMany(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.tableExists(tableName))) {
      return { count: 0 }
    }
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildDeleteQuery(
      tableName,
      query
    )
    const [result]: [{ affectedRows: number }] = await this.query(sql, values)
    return { count: result.affectedRows }
  }

  async deleteOne(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.tableExists(tableName))) {
      return { count: 0 }
    }
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildDeleteQuery(
      tableName,
      query,
      true
    )
    const [result]: [{ affectedRows: number }] = await this.query(sql, values)
    return { count: result.affectedRows }
  }

  async drop(tableName: string): Promise<any> {
    const sql = this.sqlBuilder.buildDropTableQuery(tableName)
    await this.query(sql)
  }

  private async columnExists(
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    const cacheKey = `${tableName}.${columnName}`
    if (this.columnExistsCache.has(cacheKey)) {
      return this.columnExistsCache.get(cacheKey)!
    }
    const query = this.sqlBuilder.buildColumnExistsQuery()
    const [rows] = await this.query(query, [tableName, columnName])
    const exists = rows[0].count > 0
    if (exists) this.columnExistsCache.set(cacheKey, exists)
    return exists
  }

  private async indexExists(
    tableName: string,
    indexName: string
  ): Promise<boolean> {
    const cacheKey = `${tableName}.${indexName}`
    if (this.indexExistsCache.has(cacheKey)) {
      return true
    }

    const query = this.sqlBuilder.buildIndexExistsQuery()
    const [rows] = await this.query(query, [tableName, indexName])
    const exists = rows[0].count > 0
    if (exists) this.indexExistsCache.set(cacheKey, exists)
    return exists
  }

  async createIndex(
    tableName: string,
    indexSpec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    if (!(await this.tableExists(tableName))) {
      await this.createTable(tableName)
    }

    const sanitizedTableName = this.sqlBuilder.sanitizeIdentifier(tableName)
    let indexName = options?.name || 'index_' + Date.now()

    if (typeof indexSpec === 'string') {
      indexSpec = { [indexSpec]: -1 }
    }

    let columns = {}
    for (const [field, order] of Object.entries(indexSpec)) {
      const formattedField = this.formatNestedColumnName(field)
      const sanitizedField = this.sqlBuilder.sanitizeIdentifier(formattedField)
      const suffix = options?.lowercase ? GENERATED_COLUMN_LOWERCASE_SUFFIX : ''
      const generatedColumnName =
        GENERATED_COLUMN_PREFIX + sanitizedField + suffix

      columns[generatedColumnName] = order

      if (!(await this.columnExists(sanitizedTableName, generatedColumnName))) {
        const isIdField = /id$/i.test(field)
        const size = isIdField ? JDOC_ID_SIZE : COLUMN_SIZE_DEFAULT
        const typeHint = isIdField ? 'char' : options?.typeHint
        const collation = isIdField
          ? 'CHARACTER SET ascii COLLATE ascii_general_ci'
          : ''

        const createColumnText = this.sqlBuilder.buildCreateColumnQuery(
          sanitizedTableName,
          generatedColumnName,
          field,
          size,
          collation,
          typeof typeHint === 'object' ? typeHint[field] : typeHint,
          options?.lowercase
        )
        await this.query(createColumnText)
      }
    }
    const columnsSql = Object.keys(columns)
      .map((specColumn) => {
        const order = columns[specColumn] === -1 ? 'DESC' : 'ASC'
        return `${specColumn} ${order}`
      })
      .join(', ')

    if (!(await this.indexExists(sanitizedTableName, indexName))) {
      const indexText = this.sqlBuilder.buildCreateIndexQuery(
        sanitizedTableName,
        indexName,
        columnsSql,
        !!options?.unique
      )
      await this.query(indexText)
    }
  }

  async dropIndex(tableName: string, indexName: string): Promise<any> {
    const sql = this.sqlBuilder.buildDropIndexQuery(tableName, indexName)
    await this.query(sql)
  }

  async dropIndexes(tableName: string): Promise<any> {
    const sanitizedTableName = this.sqlBuilder.sanitizeIdentifier(tableName)

    const query = this.sqlBuilder.buildGetIndexesQuery()
    const [rows] = await this.query(query, [tableName])

    for (const row of rows) {
      const indexName = row.INDEX_NAME
      const dropIndexQuery = this.sqlBuilder.buildDropIndexQuery(
        sanitizedTableName,
        indexName
      )
      await this.query(dropIndexQuery)
    }
  }

  async findGroup<Type>(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Type[]> {
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildFindGroupQuery(
      tableName,
      groupFields,
      query
    )
    const [rows] = await this.query(sql, values)
    return rows as Type[]
  }

  async groupCount(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.sqlBuilder.buildGroupCountQuery(
      tableName,
      groupFields,
      query
    )
    const [rows] = await this.query(sql, values)

    // Transform rows to include _id as an object with group fields
    const result = rows.map((row: any) => {
      const _id = groupFields.reduce((acc, field) => {
        acc[field] = row[field]
        return acc
      }, {} as any)
      return { _id, count: row.count }
    })

    return result
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.release()
    }
    await this.pool.end()
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (this.tableExistsCache.has(tableName)) {
      return true
    }

    const query = this.sqlBuilder.buildTableExistsQuery()
    const [rows] = await this.query(query, [tableName])
    const exists = rows[0].count > 0
    if (exists) this.tableExistsCache.set(tableName, exists)
    return exists
  }

  async createTable(tableName: string): Promise<void> {
    if (await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} already exists`)
    }

    const sql = this.sqlBuilder.buildCreateTableQuery(
      tableName,
      JDOC_ID_PROP,
      JDOC_ID_SIZE
    )
    await this.query(sql)

    this.tableExistsCache.set(tableName, true)
  }

  async transactionStart(): Promise<void> {
    if (this.connection) {
      throw new Error('Transaction already in progress')
    }
    this.connection = await this.pool.getConnection()
    await this.connection.beginTransaction()
  }

  async transactionCommit(): Promise<void> {
    if (!this.connection) {
      throw new Error('No transaction in progress')
    }
    await this.connection.commit()
    this.connection.release()
    this.connection = null
  }

  async transactionRollback(): Promise<void> {
    if (!this.connection) {
      throw new Error('No transaction in progress')
    }
    await this.connection.rollback()
    this.connection.release()
    this.connection = null
  }

  private async query(sql: string, values?: any[]): Promise<any> {
    if (this.connection) {
      return this.connection.query(sql, values)
    } else {
      return this.pool.query(sql, values)
    }
  }

  private formatNestedColumnName(field: string): string {
    return field.replace(/\./g, '_')
  }

  private filterFields(row: any, fields: Record<string, number>): any {
    const includeMode = Object.values(fields).some((v) => v === 1)
    const excludeMode = Object.values(fields).some((v) => v === 0)

    if (includeMode && excludeMode) {
      throw new Error('Cannot mix include (1) and exclude (0) in fields option')
    }

    const pathsToRemove: string[] = []

    if (includeMode) {
      // Convert include mode to exclude mode
      this.collectPathsToRemove(row, '', fields, pathsToRemove)
    } else {
      // Exclude mode: collect paths to remove
      for (const [path, exclude] of Object.entries(fields)) {
        if (exclude === 0) {
          pathsToRemove.push(path)
        }
      }
    }

    // Remove paths
    for (const path of pathsToRemove) {
      ObjectPathAccessor.unsetPath(path, row)
    }

    return row
  }

  private collectPathsToRemove(
    obj: any,
    currentPath: string,
    fields: Record<string, number>,
    pathsToRemove: string[]
  ): void {
    if (typeof obj !== 'object' || obj === null) {
      return
    }

    for (const key in obj) {
      const newPath = currentPath ? `${currentPath}.${key}` : key
      if (fields[newPath] !== 1) {
        pathsToRemove.push(newPath)
      } else if (typeof obj[key] === 'object') {
        this.collectPathsToRemove(obj[key], newPath, fields, pathsToRemove)
      }
    }
  }
}

export default DataSourceMysql
