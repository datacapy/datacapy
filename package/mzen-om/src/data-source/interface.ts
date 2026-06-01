import internal from 'stream'

export interface QueryOperatorLogical {
  $and?: QuerySelection[]
  $or?: QuerySelection[]
  $not?: QueryOperatorSelection
  $nor?: QueryOperatorSelection[]
}

export interface QueryOperatorSelection {
  $eq?: any // equals
  $gt?: any // greater than
  $gte?: any // greater than or equal to
  $in?: any[] // in
  $lt?: any // less than
  $lte?: any // less than or equal to
  $ne?: any // not equal
  $nin?: any[] // not in
  $like?: any[] // MySQL style LIKE operator

  $exists?: boolean // match documents that have or do not have the specified field

  [key: string]: any // accept implementation specific props
}

export interface QuerySelection {
  // Property name specifies a field name and may use dot notation to target embedded documents
  [key: string]: QueryOperatorSelection | QueryOperatorLogical | any
}

export interface QueryPipeline {
  $match?: QuerySelection
  $group?: { [key: string]: any }
  $project?: { count?: number }
  $replaceRoot?: { newRoot: string }
}

export interface QuerySelectionOptions {
  limit?: number
  skip?: number
  sort?: { [key: string]: number }
  fields?: { [key: string]: number } // doc of fields to include or exclude (not both), {'field':1} or  {'field':0}
  comment?: string // comment to make looking in logs simpler

  [key: string]: any // accept implementation specific props
}

export interface QueryUpdate {
  // in each of these operators the property name specifies a field name
  // - and may use dot notation to target embedded documents
  $set?: { [key: string]: any }
  $setOnInsert?: { [key: string]: any } // fields written only when inserting a new document; ignored on update
  $unset?: { [key: string]: any } // deletes a particular field the specified field value is not important
  $inc?: { [key: string]: number } // increments a field by a specified value
  $mul?: { [key: string]: number } // multiply the value of a field by a number
  $min?: { [key: string]: any } // updates the value if the specified value is less than the current value of the field
  $max?: { [key: string]: any } // updates the value if the specified value is greater than the current value of the field (number or date)
  $push?: { [key: string]: any } // appends a value to an array field; supports $each modifier for multiple values
  $addToSet?: { [key: string]: any } // appends a value to an array only if it does not already exist; supports $each modifier
  $pop?: { [key: string]: 1 | -1 } // removes the last (1) or first (-1) element of an array
  $pull?: { [key: string]: any } // removes all elements from an array that match a specified scalar value
  $pullAll?: { [key: string]: any[] } // removes all occurrences of each listed value from an array

  [key: string]: any // accept implementation specific props
}

export interface IndexSpec {
  [key: string]: string | number // { fieldName: 1 } or { fieldName: -1 } or { fieldName: 'text }
}

export type TypeHintValue =
  | 'string'
  | 'char'
  | 'int'
  | 'bigint'
  | 'bigintUnsigned'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'timestamp'

export interface IndexOptions {
  name?: string
  unique?: boolean
  sparse?: boolean // may not be supported by all implementations
  background?: boolean // may not be supported by all implementations
  expireAfterSeconds?: number // may not be supported by all implementations
  typeHint?: TypeHintValue | { [field: string]: TypeHintValue } // added for MySQL generated indexes; string applies to all fields, object maps per-field
  lowercase?: boolean // MySQL only: stores LOWER() of the value for efficient case-insensitive LIKE queries
}

export interface QueryPersistResult {
  count: number // number of documents inserted / updated / deleted
}

export interface QueryPersistResultInsertMany extends QueryPersistResult {
  ids: { [key: number]: any } // map of the index of the inserted document to the id of the inserted document
}

export interface QueryPersistResultInsertOne extends QueryPersistResult {
  id: any // id of inserted or updated documents if only one doc was inserted / updated or id of the first doc inserted/updated
}

export interface QueryPersistResultUpsert extends QueryPersistResult {
  upsertedCount: number // number of documents inserted (as opposed to updated)
  upsertedId?: any // id of the inserted document when upsertOne inserts
}

export interface DataSourceInterface {
  isDynamic?(): boolean
  connect(): Promise<DataSourceInterface>

  createDatabase?(databaseName: string, options?: any): Promise<void>
  dropDatabase?(databaseName: string, options?: any): Promise<void>

  find(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>[]>

  findOne(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>>

  findGroup(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>[]>

  count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number>

  groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>>

  insertMany(
    collectionName: string,
    docs: any[],
    options?: any
  ): Promise<QueryPersistResultInsertMany>

  insertOne(
    collectionName: string,
    doc: any,
    options?: any
  ): Promise<QueryPersistResultInsertOne>

  updateMany(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult>

  updateOne(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult>

  upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert>

  upsertOne(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert>

  deleteMany(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult>

  deleteOne(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult>

  drop(collectionName: string): Promise<any>

  createIndex(
    collectionName: string,
    spec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any>

  dropIndex(collectionName: string, indexName: string): Promise<any>

  dropIndexes(collectionName: string): Promise<any>

  transactionStart(): Promise<void>
  transactionCommit(): Promise<void>
  transactionRollback(): Promise<void>

  close(): Promise<void>
}

export default DataSourceInterface
