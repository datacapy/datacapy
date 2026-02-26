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
import clone = require('clone')

type IdValue = number | string
type Idable<T> = {
  _id?: IdValue
} & T

export class DataSourceMock implements DataSourceInterface {
  data: any
  dataInsert: any[]
  dataUpdate: any[]
  queryCount: number

  constructor(data) {
    this.data = data
    // On every call to insert data we append to this array
    // - so our tests can assert the state of the data at the point of insert
    this.dataInsert = []
    // On every call to update data we append to this array
    // - so our tests can assert the state of the data at the point of update
    this.dataUpdate = []
    this.queryCount = 0
  }

  async connect(): Promise<DataSourceInterface> {
    // This is a in memory data store - there is nothing to connect to
    // - we can resolve immediately
    return Promise.resolve(this)
  }

  async createDatabase(databaseName: string, options?: any): Promise<void> {
    // No-op for mock datasource - databases don't exist in the mock
    return Promise.resolve()
  }

  async dropDatabase(databaseName: string, options?: any): Promise<void> {
    // No-op for mock datasource - databases don't exist in the mock
    return Promise.resolve()
  }

  async find(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Document[]> {
    this.queryCount++
    var data = this.filterData(collectionName, query, options)
    // We must clone the result to prevent circular references
    return clone(data)
  }

  async findOne(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Document> {
    this.queryCount++
    var data = this.filterData(collectionName, query, options)
    // We must clone the result to prevent circular references
    return clone(data[0])
  }

  async findGroup(
    collectionName: string,
    _groupFields: string[],
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ) {
    this.queryCount++
    var data = this.filterData(collectionName, query, options)
    // We must clone the result to prevent circular references
    return clone(data[0])
  }

  async count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    this.queryCount++
    var data = this.filterData(collectionName, query, options)
    var count = Array.isArray(data) ? data.length : 0
    return count
  }

  async groupCount(
    _collectionName: string,
    _groupFields: string[],
    _query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    return [{ _id: { name: 'Tom' }, count: 10 }]
  }

  filterData(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ) {
    options = options ? options : {}
    var data = this.data[collectionName]
    var result: Document[] = []
    for (var x in data) {
      var matches = this.matchesQuery(data[x], query)
      if (matches) {
        result.push(data[x])
      }
      if (options['limit'] && result.length == options['limit']) break
    }
    return result
  }

  private matchesQuery(doc: any, query?: QuerySelection): boolean {
    if (!query) return true

    // Handle $or operator
    if (query['$or']) {
      const orConditions = query['$or']
      return orConditions.some((condition) => this.matchesQuery(doc, condition))
    }

    // Handle regular field matching
    for (var key in query) {
      if (!query.hasOwnProperty(key)) continue
      if (key === '$or') continue // Already handled above

      var queryValue = query[key]
      if (Array.isArray(queryValue['$in'])) {
        if (queryValue['$in'].indexOf(doc[key]) === -1) {
          return false
        }
      } else {
        if (doc[key] !== queryValue) {
          return false
        }
      }
    }
    return true
  }

  async insertMany<T>(
    _collectionName: string,
    docs: Idable<T>[],
    _options?: any
  ): Promise<QueryPersistResultInsertMany> {
    this.queryCount++
    this.dataInsert = this.dataInsert.concat(docs)
    return {
      count: docs.length,
      ids: docs.map((value, index) => (value && value._id ? value._id : index)),
    }
  }

  async insertOne<T>(
    _collectionName: string,
    doc: Idable<T>,
    _options?: any
  ): Promise<QueryPersistResultInsertOne> {
    this.queryCount++
    this.dataInsert.push(doc)
    return {
      count: 1,
      id: doc && doc._id != undefined ? doc._id : null,
    }
  }

  async updateMany(
    _collectionName: string,
    _querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    _options?: any
  ): Promise<QueryPersistResult> {
    this.queryCount++
    this.dataUpdate = this.dataUpdate.concat(queryUpdate)
    return {
      count: 10,
    }
  }

  async updateOne(
    _collectionName: string,
    _querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    _options: any
  ): Promise<QueryPersistResult> {
    this.queryCount++
    this.dataUpdate = this.dataUpdate.concat(queryUpdate)
    return {
      count: 1,
    }
  }

  async deleteMany(
    // @ts-ignore - 'collectionName' is declared but its value is never read
    collectionName: string,
    // @ts-ignore - 'query' is declared but its value is never ß
    query: QuerySelection
  ): Promise<QueryPersistResult> {
    this.queryCount++
    return {
      count: 10,
    }
  }

  async deleteOne(
    _collectionName: string,
    _query: QuerySelection
  ): Promise<QueryPersistResult> {
    this.queryCount++
    return {
      count: 1,
    }
  }

  drop(_collectionName: string): Promise<any> {
    this.queryCount++
    return Promise.resolve()
  }

  createIndex(
    _collectionName: string,
    _indexSpec: IndexSpec | string,
    _options?: IndexOptions
  ): Promise<any> {
    this.queryCount++
    return Promise.resolve()
  }

  async dropIndex(_collectionName: string, _indexName: string): Promise<any> {
    return true
  }

  async dropIndexes(_collectionName: string): Promise<any> {
    return true
  }

  async transactionStart(): Promise<void> {
    throw new Error('Transactions not supported in this data source')
  }

  async transactionCommit(): Promise<void> {
    throw new Error('Transactions not supported in this data source')
  }

  async transactionRollback(): Promise<void> {
    throw new Error('Transactions not supported in this data source')
  }

  close(): Promise<any> {
    this.queryCount++
    return Promise.resolve(this)
  }
}

export default DataSourceMock
