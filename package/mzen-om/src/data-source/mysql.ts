// cspell:ignore conn
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
  QueryPersistResultUpsert,
  BulkWriteOp,
  QueryPersistResultBulk,
} from './interface'

// mysql2's promise QueryResult union isn't statement-indexed for multipleStatements queries
type MysqlBulkStatementResult = { affectedRows: number; insertId: number }
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
  ensureDatabase?: boolean
}

// Config keys that are consumed by DataSourceMysql itself and are not recognised by mysql2's
// createPool() - must be stripped before the config is passed to createPool, otherwise mysql2
// logs a deprecation warning now and will throw in a future version. Keep this list in sync with
// the custom (non-PoolOptions) keys declared on DataSourceMysqlConfig above.
const CUSTOM_CONFIG_KEYS: Array<keyof DataSourceMysqlConfig> = [
  'ensureDatabase',
]

// Dependencies injected into MysqlQueryOperations so the same CRUD method bodies can run
// against either the shared pool (DataSourceMysql) or a single leased connection
// (MysqlTransactionLease). tableExists/columnExists/createTable are always delegated back to
// DataSourceMysql - table/column existence caches and CREATE TABLE (DDL, which MySQL commits
// implicitly regardless of any open transaction) are cheap-to-keep shared resources, not
// per-caller state.
interface MysqlQueryOperationsDeps {
  query(sql: string, values?: any[]): Promise<any>
  tableExists(tableName: string): Promise<boolean>
  columnExists(tableName: string, columnName: string): Promise<boolean>
  createTable(tableName: string): Promise<void>
  sqlBuilder: MysqlSqlBuilder
}

// Holds the CRUD method bodies shared between DataSourceMysql (queries routed to the shared
// pool) and MysqlTransactionLease (queries routed to a single leased PoolConnection). Extracted
// so transaction leases do not duplicate this logic - see the "Checkout/Lease Semantics" design.
class MysqlQueryOperations {
  constructor(private deps: MysqlQueryOperationsDeps) {}

  async find<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type[]> {
    if (!(await this.deps.tableExists(tableName))) {
      return []
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildSelectQuery(
      tableName,
      query,
      options
    )

    const [rows] = await this.deps.query(sql, values)
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
    if (!(await this.deps.tableExists(tableName))) {
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
    if (!(await this.deps.tableExists(tableName))) {
      return 0
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildCountQuery(
      tableName,
      query
    )
    const [rows] = await this.deps.query(sql, values)
    return rows[0]?.count || 0
  }

  async insertMany<Type>(
    tableName: string,
    objects: Type[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    if (!(await this.deps.tableExists(tableName))) {
      await this.deps.createTable(tableName)
    }

    const { sql, values } = this.deps.sqlBuilder.buildInsertManyQuery(
      tableName,
      objects
    )

    const [result]: [{ affectedRows: number; insertId: number }] =
      await this.deps.query(sql, values)
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
    if (!(await this.deps.tableExists(tableName))) {
      await this.deps.createTable(tableName)
    }

    const { sql, values } = this.deps.sqlBuilder.buildInsertOneQuery(
      tableName,
      object
    )

    const [result]: [{ affectedRows: number; insertId: number }] =
      await this.deps.query(sql, values)
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
    if (!(await this.deps.tableExists(tableName))) {
      return { count: 0 }
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildUpdateQuery(
      tableName,
      querySelect,
      queryUpdate
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    return { count: result.affectedRows }
  }

  async updateOne(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.deps.tableExists(tableName))) {
      return { count: 0 }
    }

    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildUpdateQuery(
      tableName,
      querySelect,
      queryUpdate,
      true
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    return { count: result.affectedRows }
  }

  async upsertMany(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    if (!(await this.deps.tableExists(tableName))) {
      await this.deps.createTable(tableName)
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildUpdateQuery(
      tableName,
      filter,
      update
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    if (result.affectedRows > 0) {
      return { count: result.affectedRows, upsertedCount: 0 }
    }
    const insertDoc = {
      ...this._extractEqualityFields(filter),
      ...(update.$set ?? {}),
      ...(update.$setOnInsert ?? {}),
    }
    const insertResult = await this.insertOne(tableName, insertDoc, options)
    return {
      count: insertResult.count,
      upsertedCount: insertResult.count,
      upsertedId: insertResult.id,
    }
  }

  async upsertOne(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    if (!(await this.deps.tableExists(tableName))) {
      await this.deps.createTable(tableName)
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildUpdateQuery(
      tableName,
      filter,
      update,
      true
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    if (result.affectedRows > 0) {
      return { count: result.affectedRows, upsertedCount: 0 }
    }
    const insertDoc = {
      ...this._extractEqualityFields(filter),
      ...(update.$set ?? {}),
      ...(update.$setOnInsert ?? {}),
    }
    const insertResult = await this.insertOne(tableName, insertDoc, options)
    return {
      count: insertResult.count,
      upsertedCount: insertResult.count,
      upsertedId: insertResult.id,
    }
  }

  async deleteMany(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.deps.tableExists(tableName))) {
      return { count: 0 }
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildDeleteQuery(
      tableName,
      query
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    return { count: result.affectedRows }
  }

  async deleteOne(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    if (!(await this.deps.tableExists(tableName))) {
      return { count: 0 }
    }
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildDeleteQuery(
      tableName,
      query,
      true
    )
    const [result]: [{ affectedRows: number }] = await this.deps.query(
      sql,
      values
    )
    return { count: result.affectedRows }
  }

  async findGroup<Type>(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Type[]> {
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildFindGroupQuery(
      tableName,
      groupFields,
      query
    )
    const [rows] = await this.deps.query(sql, values)
    return rows as Type[]
  }

  async groupCount(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    this.deps.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.deps.columnExists(table, column),
      tableName
    )
    const { sql, values } = await this.deps.sqlBuilder.buildGroupCountQuery(
      tableName,
      groupFields,
      query
    )
    const [rows] = await this.deps.query(sql, values)

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

  private _extractEqualityFields(filter: QuerySelection): Record<string, any> {
    const doc: Record<string, any> = {}
    for (const [key, val] of Object.entries(filter)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val))
        continue
      doc[key] = val
    }
    return doc
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

export class DataSourceMysql implements DataSourceInterface {
  private pool: Pool
  private config: DataSourceMysqlConfig
  private sqlBuilder: MysqlSqlBuilder
  private columnExistsCache: Map<string, boolean> = new Map()
  private indexExistsCache: Map<string, boolean> = new Map()
  private tableExistsCache: Map<string, boolean> = new Map()
  private bulkPool: Pool | null = null
  private queryOps: MysqlQueryOperations
  // Count of currently outstanding MysqlTransactionLease instances issued by transactionStart().
  // DataSourceRegistry consults hasActiveLeases() before closing this instance's pool so an
  // in-progress lease on another concurrent caller is never torn out from under it.
  private activeLeaseCount = 0

  constructor(config: DataSourceMysqlConfig) {
    this.config = config
    this.pool = createPool(this.toPoolOptions(this.config))
    this.sqlBuilder = new MysqlSqlBuilder()
    this.queryOps = new MysqlQueryOperations({
      query: (sql, values) => this.pool.query(sql, values),
      tableExists: (tableName) => this.tableExists(tableName),
      columnExists: (tableName, columnName) =>
        this.columnExists(tableName, columnName),
      createTable: (tableName) => this.createTable(tableName),
      sqlBuilder: new MysqlSqlBuilder(),
    })
  }

  async connect(): Promise<DataSourceInterface> {
    if (this.config.ensureDatabase && this.config.database) {
      const { database, ...rest } = this.toPoolOptions(this.config)
      const bootstrapPool = createPool(rest)
      try {
        const conn = await bootstrapPool.getConnection()
        await conn.query(
          `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        )
        conn.release()
      } finally {
        await bootstrapPool.end()
      }
    }
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
    return this.queryOps.find<Type>(tableName, query, options)
  }

  async findOne<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type | null> {
    return this.queryOps.findOne<Type>(tableName, query, options)
  }

  async count(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    return this.queryOps.count(tableName, query, options)
  }

  async insertMany<Type>(
    tableName: string,
    objects: Type[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    return this.queryOps.insertMany<Type>(tableName, objects, options)
  }

  async insertOne<Type>(
    tableName: string,
    object: Type,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    return this.queryOps.insertOne<Type>(tableName, object, options)
  }

  async updateMany(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    return this.queryOps.updateMany(
      tableName,
      querySelect,
      queryUpdate,
      options
    )
  }

  async updateOne(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    return this.queryOps.updateOne(tableName, querySelect, queryUpdate, options)
  }

  async upsertMany(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    return this.queryOps.upsertMany(tableName, filter, update, options)
  }

  async upsertOne(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    return this.queryOps.upsertOne(tableName, filter, update, options)
  }

  async deleteMany(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    return this.queryOps.deleteMany(tableName, query, options)
  }

  async deleteOne(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    return this.queryOps.deleteOne(tableName, query, options)
  }

  async findGroup<Type>(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Type[]> {
    return this.queryOps.findGroup<Type>(tableName, groupFields, query)
  }

  async groupCount(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    return this.queryOps.groupCount(tableName, groupFields, query)
  }

  async bulkWrite(
    tableName: string,
    ops: BulkWriteOp[],
    options?: any
  ): Promise<QueryPersistResultBulk> {
    const result: QueryPersistResultBulk = {
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      insertedIds: {},
      upsertedIds: {},
    }

    if (ops.length === 0) {
      return result
    }

    const hasInsert = ops.some((op) => 'insertOne' in op)
    if (hasInsert && !(await this.tableExists(tableName))) {
      await this.createTable(tableName)
    }

    this.sqlBuilder.setColumnExistsChecker(
      (table, column) => this.columnExists(table, column),
      tableName
    )

    const statements: { sql: string; values: any[] }[] = []
    for (const op of ops) {
      if ('insertOne' in op) {
        statements.push(
          this.sqlBuilder.buildInsertOneQuery(tableName, op.insertOne.document)
        )
      } else if ('updateOne' in op) {
        statements.push(
          await this.sqlBuilder.buildUpdateQuery(
            tableName,
            op.updateOne.filter,
            op.updateOne.update,
            true
          )
        )
      } else if ('updateMany' in op) {
        statements.push(
          await this.sqlBuilder.buildUpdateQuery(
            tableName,
            op.updateMany.filter,
            op.updateMany.update
          )
        )
      } else if ('deleteOne' in op) {
        statements.push(
          await this.sqlBuilder.buildDeleteQuery(
            tableName,
            op.deleteOne.filter,
            true
          )
        )
      } else if ('deleteMany' in op) {
        statements.push(
          await this.sqlBuilder.buildDeleteQuery(
            tableName,
            op.deleteMany.filter
          )
        )
      } else {
        throw new Error('Unsupported bulkWrite operation')
      }
    }

    const combinedSql = statements.map((s) => s.sql).join('; ')
    const combinedValues = statements.flatMap((s) => s.values)

    const bulkPool = this.getBulkPool()
    const conn = await bulkPool.getConnection()
    try {
      await conn.beginTransaction()
      let rawResults: MysqlBulkStatementResult | MysqlBulkStatementResult[]
      try {
        // mysql2's QueryResult union has no statement-indexed shape for multipleStatements
        // queries - cast at this driver boundary, same as the [{affectedRows,insertId}] casts
        // used by the singular insert/update/delete methods elsewhere in this file.
        const [queryResult] = (await conn.query(
          combinedSql,
          combinedValues
        )) as unknown as [
          MysqlBulkStatementResult | MysqlBulkStatementResult[],
          unknown,
        ]
        rawResults = queryResult
        await conn.commit()
      } catch (err) {
        // mysql2 aborts the whole multi-statement batch on the first error and does not
        // reliably expose which statement failed - callers needing that precision must fall
        // back to smaller batches or per-op calls.
        await conn.rollback()
        throw err
      }

      // mysql2 unwraps the outer per-statement array when only one statement is executed
      const perStatementResults: MysqlBulkStatementResult[] =
        statements.length === 1
          ? [rawResults as MysqlBulkStatementResult]
          : (rawResults as MysqlBulkStatementResult[])

      ops.forEach((op, index) => {
        const stmtResult = perStatementResults[index]
        if ('insertOne' in op) {
          result.insertedCount += stmtResult.affectedRows
          result.insertedIds[index] = stmtResult.insertId
        } else if ('updateOne' in op || 'updateMany' in op) {
          // MySQL's affectedRows conflates matched/modified (CLIENT_FOUND_ROWS not set)
          result.matchedCount += stmtResult.affectedRows
          result.modifiedCount += stmtResult.affectedRows
        } else if ('deleteOne' in op || 'deleteMany' in op) {
          result.deletedCount += stmtResult.affectedRows
        }
      })

      return result
    } finally {
      conn.release()
    }
  }

  // Same config as the main pool, plus multipleStatements - isolated to this dedicated pool so
  // the shared `this.pool` used by every other query is never exposed to stacked-query injection
  // risk. Created once and cached (not per-call) to avoid the cost of establishing and tearing
  // down a pool on every bulkWrite call; closed alongside the main pool in close(). This also
  // means bulkWrite never participates in an already-open transactionStart()/transactionCommit()
  // pair - it is always its own atomic unit on its own connection, on both DataSourceMysql and
  // any MysqlTransactionLease (which delegates bulkWrite straight back to this method).
  private getBulkPool(): Pool {
    if (!this.bulkPool) {
      this.bulkPool = createPool({
        ...this.toPoolOptions(this.config),
        multipleStatements: true,
      })
    }
    return this.bulkPool
  }

  async drop(tableName: string): Promise<any> {
    const sql = this.sqlBuilder.buildDropTableQuery(tableName)
    await this.query(sql)
  }

  async columnExists(tableName: string, columnName: string): Promise<boolean> {
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
        const explicitTypeHint =
          typeof options?.typeHint === 'object'
            ? options.typeHint[field]
            : options?.typeHint
        // Fields ending in "id" default to the internal generated-id sizing, but an
        // explicit typeHint (e.g. for external ids like a Stripe customer id) opts out
        const isIdField = !explicitTypeHint && /id$/i.test(field)
        const size = isIdField ? JDOC_ID_SIZE : COLUMN_SIZE_DEFAULT
        const typeHint = isIdField ? 'char' : explicitTypeHint
        const collation = isIdField
          ? 'CHARACTER SET ascii COLLATE ascii_bin'
          : ''

        const createColumnText = this.sqlBuilder.buildCreateColumnQuery(
          sanitizedTableName,
          generatedColumnName,
          field,
          size,
          collation,
          typeHint,
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

  async close(): Promise<void> {
    await this.pool.end()
    if (this.bulkPool) {
      await this.bulkPool.end()
      this.bulkPool = null
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (this.tableExistsCache.has(tableName)) {
      return this.tableExistsCache.get(tableName)!
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

  // Acquires a dedicated PoolConnection and returns an exclusive MysqlTransactionLease bound to
  // it. Unlike the previous single shared `this.connection` field, concurrent callers each get
  // their own independent lease - no "Transaction already in progress" guard is needed here
  // because there is no shared transaction state left to guard.
  async transactionStart(): Promise<DataSourceInterface> {
    const connection = await this.pool.getConnection()
    await connection.beginTransaction()
    this.activeLeaseCount++
    return new MysqlTransactionLease(this, connection)
  }

  async transactionCommit(): Promise<void> {
    throw new Error(
      'No transaction in progress on this datasource. transactionStart() returns a dedicated ' +
        'lease - call transactionCommit() on that lease, not on the shared datasource instance.'
    )
  }

  async transactionRollback(): Promise<void> {
    throw new Error(
      'No transaction in progress on this datasource. transactionStart() returns a dedicated ' +
        'lease - call transactionRollback() on that lease, not on the shared datasource instance.'
    )
  }

  hasActiveLeases(): boolean {
    return this.activeLeaseCount > 0
  }

  // Called by MysqlTransactionLease on commit/rollback. Not part of DataSourceInterface -
  // internal bookkeeping only, exposed publicly because TypeScript has no "friend class"
  // mechanism to share it privately between DataSourceMysql and MysqlTransactionLease.
  releaseLease(): void {
    this.activeLeaseCount = Math.max(0, this.activeLeaseCount - 1)
  }

  private async query(sql: string, values?: any[]): Promise<any> {
    return this.pool.query(sql, values)
  }

  private formatNestedColumnName(field: string): string {
    return field.replace(/\./g, '_')
  }

  // Strips config keys that DataSourceMysql itself consumes (e.g. ensureDatabase) but that
  // mysql2's createPool() does not recognise - see the CUSTOM_CONFIG_KEYS comment above.
  private toPoolOptions(config: DataSourceMysqlConfig): PoolOptions {
    const poolConfig: DataSourceMysqlConfig = { ...config }
    for (const key of CUSTOM_CONFIG_KEYS) {
      delete poolConfig[key]
    }
    return poolConfig
  }
}

// Exclusive lease over a single PoolConnection with its own open transaction, issued by
// DataSourceMysql.transactionStart(). Every plain query issued through a lease routes onto that
// dedicated connection; concurrent callers on the same DataSourceMysql instance never see each
// other's transaction state (the bug this class exists to fix). Schema-existence caches and DDL
// (createTable/createIndex/etc) are delegated back to the parent - they are cheap-to-keep shared
// resources, and MySQL commits DDL implicitly regardless of any open application transaction.
class MysqlTransactionLease implements DataSourceInterface {
  private closed = false
  private queryOps: MysqlQueryOperations

  constructor(
    private parent: DataSourceMysql,
    private connection: PoolConnection
  ) {
    this.queryOps = new MysqlQueryOperations({
      query: (sql, values) => connection.query(sql, values),
      tableExists: (tableName) => parent.tableExists(tableName),
      columnExists: (tableName, columnName) =>
        parent.columnExists(tableName, columnName),
      createTable: (tableName) => parent.createTable(tableName),
      sqlBuilder: new MysqlSqlBuilder(),
    })
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error(
        'This transaction lease has already been committed or rolled back'
      )
    }
  }

  async connect(): Promise<DataSourceInterface> {
    return this
  }

  async createDatabase(databaseName: string, options?: any): Promise<void> {
    return this.parent.createDatabase(databaseName, options)
  }

  async dropDatabase(databaseName: string, options?: any): Promise<void> {
    return this.parent.dropDatabase(databaseName, options)
  }

  async execute(sql: string, values?: any[]): Promise<any> {
    this.assertOpen()
    return this.connection.query(sql, values)
  }

  async find<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type[]> {
    this.assertOpen()
    return this.queryOps.find<Type>(tableName, query, options)
  }

  async findOne<Type>(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type | null> {
    this.assertOpen()
    return this.queryOps.findOne<Type>(tableName, query, options)
  }

  async count(
    tableName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    this.assertOpen()
    return this.queryOps.count(tableName, query, options)
  }

  async insertMany<Type>(
    tableName: string,
    objects: Type[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    this.assertOpen()
    return this.queryOps.insertMany<Type>(tableName, objects, options)
  }

  async insertOne<Type>(
    tableName: string,
    object: Type,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    this.assertOpen()
    return this.queryOps.insertOne<Type>(tableName, object, options)
  }

  async updateMany(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.queryOps.updateMany(
      tableName,
      querySelect,
      queryUpdate,
      options
    )
  }

  async updateOne(
    tableName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.queryOps.updateOne(tableName, querySelect, queryUpdate, options)
  }

  async upsertMany(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    this.assertOpen()
    return this.queryOps.upsertMany(tableName, filter, update, options)
  }

  async upsertOne(
    tableName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    this.assertOpen()
    return this.queryOps.upsertOne(tableName, filter, update, options)
  }

  async deleteMany(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.queryOps.deleteMany(tableName, query, options)
  }

  async deleteOne(
    tableName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.queryOps.deleteOne(tableName, query, options)
  }

  async findGroup<Type>(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Type[]> {
    this.assertOpen()
    return this.queryOps.findGroup<Type>(tableName, groupFields, query)
  }

  async groupCount(
    tableName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    this.assertOpen()
    return this.queryOps.groupCount(tableName, groupFields, query)
  }

  async bulkWrite(
    tableName: string,
    ops: BulkWriteOp[],
    options?: any
  ): Promise<QueryPersistResultBulk> {
    // bulkWrite is always its own atomic unit on the dedicated bulkPool - see the comment on
    // DataSourceMysql.getBulkPool(). It never participates in this lease's transaction.
    return this.parent.bulkWrite(tableName, ops, options)
  }

  async drop(tableName: string): Promise<any> {
    return this.parent.drop(tableName)
  }

  async createIndex(
    tableName: string,
    indexSpec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    return this.parent.createIndex(tableName, indexSpec, options)
  }

  async dropIndex(tableName: string, indexName: string): Promise<any> {
    return this.parent.dropIndex(tableName, indexName)
  }

  async dropIndexes(tableName: string): Promise<any> {
    return this.parent.dropIndexes(tableName)
  }

  async transactionStart(): Promise<DataSourceInterface> {
    throw new Error(
      'This datasource instance is already a transaction lease - nested transactions are not supported'
    )
  }

  async transactionCommit(): Promise<void> {
    this.assertOpen()
    await this.connection.commit()
    this.connection.release()
    this.closed = true
    this.parent.releaseLease()
  }

  async transactionRollback(): Promise<void> {
    this.assertOpen()
    await this.connection.rollback()
    this.connection.release()
    this.closed = true
    this.parent.releaseLease()
  }

  async close(): Promise<void> {
    // Some generic code paths call close() defensively on any DataSourceInterface. A lease is
    // closed via transactionCommit()/transactionRollback(), not close() - warn rather than throw
    // so those defensive callers don't blow up.
    console.warn(
      '[MysqlTransactionLease] close() called - leases are closed via transactionCommit()/' +
        'transactionRollback(). Ignoring.'
    )
  }
}

export default DataSourceMysql
