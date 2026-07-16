import { MongoClient, ClientSession } from 'mongodb'
import {
  DataSourceInterface,
  QueryPipeline,
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

export interface DataSourceMongodbConfig {
  url: string
  options?: {
    ignoreUndefined?: boolean
    useNewUrlParser?: boolean
    useUnifiedTopology?: boolean
    [key: string]: any
  }
}

export class DataSourceMongodb implements DataSourceInterface {
  protected config: DataSourceMongodbConfig
  private client: MongoClient
  private db: any
  // Count of currently outstanding MongodbTransactionLease instances issued by
  // transactionStart(). Mirrors DataSourceMysql.activeLeaseCount - see mysql.ts.
  private activeLeaseCount = 0

  constructor(config: DataSourceMongodbConfig) {
    this.config = config ? config : { url: '' }
    this.client = null
    this.db = null
  }

  async connect(): Promise<DataSourceInterface> {
    try {
      require.resolve('mongodb')
    } catch (e) {
      console.error(
        'DataSourceMongodb requires "mongodb" module to be installed'
      )
      process.exit()
    }

    const mongodb = require('mongodb')

    const defaultOptions = {
      ignoreUndefined: true,
    }
    const url = this.config.url ? this.config.url : ''
    const customOptions = this.config.options ? this.config.options : {}
    const options = Object.assign({}, defaultOptions, customOptions)

    this.client = await mongodb.MongoClient.connect(url, options)
    this.db = this.client.db()
    return this
  }

  async createDatabase(databaseName: string, options?: any): Promise<void> {
    // MongoDB creates databases implicitly when you write to them
    // No explicit database creation needed
    return Promise.resolve()
  }

  async dropDatabase(databaseName: string, options?: any): Promise<void> {
    // MongoDB drops databases implicitly when all collections are removed
    // No explicit database deletion needed
    return Promise.resolve()
  }

  async find<Type>(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions,
    session?: ClientSession
  ): Promise<Type[]> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    return collection.find(query, this._findOptionsNormalize(options)).toArray()
  }

  findOne<Type>(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions,
    session?: ClientSession
  ): Promise<Type> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    return collection.findOne(query, this._findOptionsNormalize(options))
  }

  count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions,
    session?: ClientSession
  ): Promise<number> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    return collection.countDocuments(query, this._findOptionsNormalize(options))
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection,
    session?: ClientSession
  ): Promise<Array<{ _id: any; count: number }>> {
    query = query ? query : {}
    let collection = this.getCollection(collectionName, session)

    /*
    var groupFields = ['width', 'height'];
    var docs = [
      {width: 10, height: 20},
      {width: 10, height: 20},
      {width: 10, height: 20},
      {width: 3, height: 5},
      {width: 3, height: 5},
    ];
    var result = [
      {_id: {width: 10, height: 20}, count: 3},
      {_id: {width: 3, height: 5}, count: 2}
    ];
    */
    let pipeline: QueryPipeline[] = []
    if (query) pipeline.push({ $match: query })
    let aggregateId = {}
    groupFields.forEach((field) => {
      aggregateId[field] = '$' + field
    })
    pipeline.push({
      $group: {
        _id: aggregateId,
        count: { $sum: 1 },
      },
    })
    pipeline.push({ $project: { count: 1 } })

    return await collection.aggregate(pipeline).toArray()
  }

  async findGroup<Type>(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection,
    session?: ClientSession
  ): Promise<Type[]> {
    query = query ? query : {}
    var collection = this.getCollection(collectionName, session)

    /*
    var groupFields = ['userId'];
    var docs = [
      {_id: 1, userId: 1, created: new ISODate("2020-01-01T00:00:00Z")},
      {_id: 2, userId: 1, created: new ISODate("2020-01-01T00:00:00Z")},
      {_id: 3, userId: 2, created: new ISODate("2020-01-01T00:00:00Z")},
      {_id: 4, userId: 2, created: new ISODate("2020-01-01T00:00:00Z")},
      {_id: 5, userId: 2, created: new ISODate("2020-01-01T00:00:00Z")},
    ];
    var result = [
      {_id: 1, userId: 1, created: new ISODate("2020-01-01T00:00:00Z")},
      {_id: 3, userId: 2, created: new ISODate("2020-01-01T00:00:00Z")}
    ];
    */

    var pipeline: QueryPipeline[] = []
    if (query) pipeline.push({ $match: query })
    var aggregateId = {}
    groupFields.forEach((field) => {
      aggregateId[field] = '$' + field
    })
    pipeline.push({
      $group: {
        _id: aggregateId,
        data: { $first: '$$ROOT' },
      },
    })
    pipeline.push({
      $replaceRoot: { newRoot: '$data' },
    })

    return await collection.aggregate(pipeline).toArray()
  }

  async insertMany<Type>(
    collectionName: string,
    objects: Type[],
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResultInsertMany> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName, session)
    var response = await collection.insertMany(objects, options)
    return {
      count: response.insertedCount,
      ids: response.insertedIds,
    }
  }

  async insertOne<Type>(
    collectionName: string,
    object: Type,
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResultInsertOne> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName, session)
    var response = await collection.insertOne(object, options)
    return {
      count: response.insertedCount,
      id: response.insertedId,
    }
  }

  async updateMany(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResult> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName, session)
    var response = await collection.updateMany(
      querySelect,
      queryUpdate,
      options
    )
    return { count: response.modifiedCount + response.upsertedCount }
  }

  async updateOne(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options: any,
    session?: ClientSession
  ): Promise<QueryPersistResult> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName, session)
    var response = await collection.updateOne(querySelect, queryUpdate, options)
    return { count: response.modifiedCount + response.upsertedCount }
  }

  async upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResultUpsert> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    const response = await collection.updateMany(filter, update, {
      ...options,
      upsert: true,
    })
    return {
      count: response.modifiedCount + response.upsertedCount,
      upsertedCount: response.upsertedCount,
      upsertedId: response.upsertedId ?? undefined,
    }
  }

  async upsertOne(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResultUpsert> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    const response = await collection.updateOne(filter, update, {
      ...options,
      upsert: true,
    })
    return {
      count: response.modifiedCount + response.upsertedCount,
      upsertedCount: response.upsertedCount,
      upsertedId: response.upsertedId ?? undefined,
    }
  }

  async deleteMany(
    collectionName: string,
    query: QuerySelection,
    _options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResult> {
    var collection = this.getCollection(collectionName, session)
    var response = await collection.deleteMany(query)
    return { count: response.deletedCount }
  }

  async deleteOne(
    collectionName: string,
    query: QuerySelection,
    _options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResult> {
    var collection = this.getCollection(collectionName, session)
    var response = await collection.deleteOne(query)
    return { count: response.deletedCount }
  }

  async getNextValue(
    collectionName: string,
    counterName: string,
    options?: any,
    session?: ClientSession
  ): Promise<number> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    const result = await collection.findOneAndUpdate(
      { _id: counterName },
      { $inc: { seq: 1 } },
      { ...options, upsert: true, returnDocument: 'after' }
    )
    // Driver v6 returns the document directly by default; the `.value` fallback guards against
    // an `includeResultMetadata: true` caller-supplied option wrapping the response in
    // { value: <doc> }, matching how bulkWrite (above) normalizes driver-shape differences.
    return (result?.value ?? result).seq
  }

  async bulkWrite(
    collectionName: string,
    ops: BulkWriteOp[],
    options?: any,
    session?: ClientSession
  ): Promise<QueryPersistResultBulk> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName, session)
    const driverOps = ops.map((op) => {
      if ('insertOne' in op) {
        return { insertOne: { document: op.insertOne.document } }
      } else if ('updateOne' in op) {
        return {
          updateOne: {
            filter: op.updateOne.filter,
            update: op.updateOne.update,
          },
        }
      } else if ('updateMany' in op) {
        return {
          updateMany: {
            filter: op.updateMany.filter,
            update: op.updateMany.update,
          },
        }
      } else if ('deleteOne' in op) {
        return { deleteOne: { filter: op.deleteOne.filter } }
      } else if ('deleteMany' in op) {
        return { deleteMany: { filter: op.deleteMany.filter } }
      } else {
        throw new Error('Unsupported bulkWrite operation')
      }
    })
    // ordered: true is forced (not left to caller override) to keep semantics uniform with the
    // other DataSourceInterface implementations, none of which expose an unordered mode
    const response = await collection.bulkWrite(driverOps, {
      ...options,
      ordered: true,
    })
    return {
      insertedCount: response.insertedCount,
      matchedCount: response.matchedCount,
      modifiedCount: response.modifiedCount,
      deletedCount: response.deletedCount,
      upsertedCount: response.upsertedCount,
      insertedIds: response.insertedIds,
      upsertedIds: response.upsertedIds,
    }
  }

  drop(collectionName: string): Promise<any> {
    return this.getCollection(collectionName)
      .drop()
      .catch((error) => {
        // Ignore error code 26 'ns not found'
        // - otherwise re-throw
        if (error.code != 26) throw error
      })
  }

  createIndex(
    collectionName: string,
    indexSpec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    var collection = this.getCollection(collectionName)
    return collection.createIndex(indexSpec, options)
  }

  dropIndex(collectionName: string, indexName: string): Promise<any> {
    var collection = this.getCollection(collectionName)
    return collection.dropIndex(indexName)
  }

  dropIndexes(collectionName: string): Promise<any> {
    var collection = this.getCollection(collectionName)
    return collection.dropIndexes.apply(collection)
  }

  async close(): Promise<any> {
    if (this.client) {
      await this.client.close(true)
    }
    return this
  }

  private _findOptionsNormalize(options) {
    options = options ? options : {}
    if (options.fields) {
      options.projection = options.fields
      delete options.fields
    }
    return options
  }

  private getCollection(collectionName: string, session?: ClientSession) {
    const collection = this.db.collection(collectionName)
    return session ? collection.withSession(session) : collection
  }

  // Every concurrent caller gets its own dedicated MongodbTransactionLease bound to its own
  // ClientSession - no "Transaction already in progress" guard is needed here because there is
  // no shared session state left to guard. Mirrors DataSourceMysql.transactionStart().
  async transactionStart(): Promise<DataSourceInterface> {
    const session = await this.client.startSession()
    session.startTransaction()
    this.activeLeaseCount++
    return new MongodbTransactionLease(this, session)
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

  // Called by MongodbTransactionLease on commit/rollback. Not part of DataSourceInterface -
  // internal bookkeeping only, exposed publicly because TypeScript has no "friend class"
  // mechanism to share it privately between DataSourceMongodb and MongodbTransactionLease.
  releaseLease(): void {
    this.activeLeaseCount = Math.max(0, this.activeLeaseCount - 1)
  }
}

// Exclusive lease over a single ClientSession with its own open transaction, issued by
// DataSourceMongodb.transactionStart(). Every CRUD method issued through a lease threads its
// session into the parent's corresponding method via getCollection(..., session); concurrent
// callers on the same DataSourceMongodb instance never see each other's transaction state.
// DDL (drop/createIndex/dropIndex/dropIndexes) is delegated straight back to the parent,
// unscoped - see the "DDL never participates in a transaction" rule shared with
// MysqlTransactionLease (mysql.ts) and RedisTransactionLease (redis.ts).
class MongodbTransactionLease implements DataSourceInterface {
  private closed = false

  constructor(
    private parent: DataSourceMongodb,
    private session: ClientSession
  ) {}

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

  async find<Type>(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type[]> {
    this.assertOpen()
    return this.parent.find<Type>(collectionName, query, options, this.session)
  }

  async findOne<Type>(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type> {
    this.assertOpen()
    return this.parent.findOne<Type>(
      collectionName,
      query,
      options,
      this.session
    )
  }

  async count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    this.assertOpen()
    return this.parent.count(collectionName, query, options, this.session)
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    this.assertOpen()
    return this.parent.groupCount(
      collectionName,
      groupFields,
      query,
      this.session
    )
  }

  async findGroup<Type>(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Type[]> {
    this.assertOpen()
    return this.parent.findGroup<Type>(
      collectionName,
      groupFields,
      query,
      this.session
    )
  }

  async insertMany<Type>(
    collectionName: string,
    objects: Type[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    this.assertOpen()
    return this.parent.insertMany<Type>(
      collectionName,
      objects,
      options,
      this.session
    )
  }

  async insertOne<Type>(
    collectionName: string,
    object: Type,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    this.assertOpen()
    return this.parent.insertOne<Type>(
      collectionName,
      object,
      options,
      this.session
    )
  }

  async updateMany(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.parent.updateMany(
      collectionName,
      querySelect,
      queryUpdate,
      options,
      this.session
    )
  }

  async updateOne(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.parent.updateOne(
      collectionName,
      querySelect,
      queryUpdate,
      options,
      this.session
    )
  }

  async upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    this.assertOpen()
    return this.parent.upsertMany(
      collectionName,
      filter,
      update,
      options,
      this.session
    )
  }

  async upsertOne(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    this.assertOpen()
    return this.parent.upsertOne(
      collectionName,
      filter,
      update,
      options,
      this.session
    )
  }

  async getNextValue(
    collectionName: string,
    counterName: string,
    options?: any
  ): Promise<number> {
    this.assertOpen()
    return this.parent.getNextValue(
      collectionName,
      counterName,
      options,
      this.session
    )
  }

  async deleteMany(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.parent.deleteMany(collectionName, query, options, this.session)
  }

  async deleteOne(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    this.assertOpen()
    return this.parent.deleteOne(collectionName, query, options, this.session)
  }

  async bulkWrite(
    collectionName: string,
    ops: BulkWriteOp[],
    options?: any
  ): Promise<QueryPersistResultBulk> {
    this.assertOpen()
    return this.parent.bulkWrite(collectionName, ops, options, this.session)
  }

  async drop(collectionName: string): Promise<any> {
    return this.parent.drop(collectionName)
  }

  async createIndex(
    collectionName: string,
    indexSpec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    return this.parent.createIndex(collectionName, indexSpec, options)
  }

  async dropIndex(collectionName: string, indexName: string): Promise<any> {
    return this.parent.dropIndex(collectionName, indexName)
  }

  async dropIndexes(collectionName: string): Promise<any> {
    return this.parent.dropIndexes(collectionName)
  }

  async transactionStart(): Promise<DataSourceInterface> {
    throw new Error(
      'This datasource instance is already a transaction lease - nested transactions are not supported'
    )
  }

  async transactionCommit(): Promise<void> {
    this.assertOpen()
    await this.session.commitTransaction()
    await this.session.endSession()
    this.closed = true
    this.parent.releaseLease()
  }

  async transactionRollback(): Promise<void> {
    this.assertOpen()
    await this.session.abortTransaction()
    await this.session.endSession()
    this.closed = true
    this.parent.releaseLease()
  }

  async close(): Promise<void> {
    // Some generic code paths call close() defensively on any DataSourceInterface. A lease is
    // closed via transactionCommit()/transactionRollback(), not close() - warn rather than throw
    // so those defensive callers don't blow up.
    console.warn(
      '[MongodbTransactionLease] close() called - leases are closed via transactionCommit()/' +
        'transactionRollback(). Ignoring.'
    )
  }
}

export default DataSourceMongodb
