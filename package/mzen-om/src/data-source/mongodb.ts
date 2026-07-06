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
  private session: ClientSession | null = null

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
    options?: QuerySelectionOptions
  ): Promise<Type[]> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
    return collection.find(query, this._findOptionsNormalize(options)).toArray()
  }

  findOne<Type>(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Type> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
    return collection.findOne(query, this._findOptionsNormalize(options))
  }

  count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    query = query ? query : {}
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
    return collection.countDocuments(query, this._findOptionsNormalize(options))
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    query = query ? query : {}
    let collection = this.getCollection(collectionName)

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
    query?: QuerySelection
  ): Promise<Type[]> {
    query = query ? query : {}
    var collection = this.getCollection(collectionName)

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
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName)
    var response = await collection.insertMany(objects, options)
    return {
      count: response.insertedCount,
      ids: response.insertedIds,
    }
  }

  async insertOne<Type>(
    collectionName: string,
    object: Type,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName)
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
    options?: any
  ): Promise<QueryPersistResult> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName)
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
    options: any
  ): Promise<QueryPersistResult> {
    options = options ? options : {}
    var collection = this.getCollection(collectionName)
    var response = await collection.updateOne(querySelect, queryUpdate, options)
    return { count: response.modifiedCount + response.upsertedCount }
  }

  async upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
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
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
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
    _options?: any
  ): Promise<QueryPersistResult> {
    var collection = this.getCollection(collectionName)
    var response = await collection.deleteMany(query)
    return { count: response.deletedCount }
  }

  async deleteOne(
    collectionName: string,
    query: QuerySelection,
    _options?: any
  ): Promise<QueryPersistResult> {
    var collection = this.getCollection(collectionName)
    var response = await collection.deleteOne(query)
    return { count: response.deletedCount }
  }

  async bulkWrite(
    collectionName: string,
    ops: BulkWriteOp[],
    options?: any
  ): Promise<QueryPersistResultBulk> {
    options = options ? options : {}
    const collection = this.getCollection(collectionName)
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
    if (this.session) {
      await this.session.endSession()
      this.session = null
    }
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

  private getCollection(collectionName?: string, options?) {
    const collection = this.db.collection(collectionName, options)
    return this.session ? collection.withSession(this.session) : collection
  }

  async transactionStart(): Promise<void> {
    if (this.session) {
      throw new Error('Transaction already in progress')
    }
    this.session = await this.client.startSession()
    this.session.startTransaction()
  }

  async transactionCommit(): Promise<void> {
    if (!this.session) {
      throw new Error('No transaction in progress')
    }
    await this.session.commitTransaction()
    await this.session.endSession()
    this.session = null
  }

  async transactionRollback(): Promise<void> {
    if (!this.session) {
      throw new Error('No transaction in progress')
    }
    await this.session.abortTransaction()
    await this.session.endSession()
    this.session = null
  }
}

export default DataSourceMongodb
