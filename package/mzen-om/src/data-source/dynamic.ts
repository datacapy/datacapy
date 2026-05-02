import {
  DataSourceInterface,
  IndexOptions,
  IndexSpec,
  QueryPersistResult,
  QueryPersistResultInsertMany,
  QueryPersistResultInsertOne,
  QueryPersistResultUpsert,
  QuerySelection,
  QuerySelectionOptions,
  QueryUpdate,
} from './interface'

/**
 * DynamicDataSource - Placeholder datasource for repos that require runtime context
 *
 * This class serves as a placeholder that:
 * 1. Can be injected into repos during initialization
 * 2. Doesn't attempt to connect to any database
 * 3. Throws helpful errors if methods are called directly
 * 4. Signals to repos that they need context to resolve the actual datasource
 *
 * Used for project-specific, tenant-specific, or other context-dependent datasources.
 */
export class DataSourceDynamic implements DataSourceInterface {
  private config: Record<string, any>

  constructor(config: Record<string, any> = {}) {
    this.config = config
  }

  /**
   * Identifies this as a dynamic datasource
   */
  isDynamic(): boolean {
    return true
  }

  /**
   * No-op: Dynamic datasources don't establish connections at startup
   */
  async connect(): Promise<DataSourceInterface> {
    return this
  }

  /**
   * No-op: Dynamic datasources have nothing to close
   */
  async close(): Promise<void> {
    // No-op
  }

  async createDatabase(databaseName: string, options?: any): Promise<void> {
    throw new Error(
      `Cannot create database on dynamic datasource directly. Database creation should happen before dynamic repo initialization.`
    )
  }

  async dropDatabase(databaseName: string, options?: any): Promise<void> {
    throw new Error(
      `Cannot drop database on dynamic datasource directly. Database deletion should happen outside of dynamic repo context.`
    )
  }

  // All query methods throw errors directing users to use repos with context

  async find(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>[]> {
    throw new Error(
      `Cannot query dynamic datasource directly. Use repo methods with DataSourceContext (e.g., repo.find(query, options, context))`
    )
  }

  async findOne(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>> {
    throw new Error(
      `Cannot query dynamic datasource directly. Use repo methods with DataSourceContext (e.g., repo.findOne(query, options, context))`
    )
  }

  async findGroup(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string | number, any>[]> {
    throw new Error(
      `Cannot query dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async count(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<number> {
    throw new Error(
      `Cannot query dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    throw new Error(
      `Cannot query dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async insertMany(
    collectionName: string,
    docs: any[],
    options?: any
  ): Promise<QueryPersistResultInsertMany> {
    throw new Error(
      `Cannot insert into dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async insertOne(
    collectionName: string,
    doc: any,
    options?: any
  ): Promise<QueryPersistResultInsertOne> {
    throw new Error(
      `Cannot insert into dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async updateMany(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    throw new Error(
      `Cannot update dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async updateOne(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResult> {
    throw new Error(
      `Cannot update dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    throw new Error(
      `Cannot upsert into dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async upsertOne(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    options?: any
  ): Promise<QueryPersistResultUpsert> {
    throw new Error(
      `Cannot upsert into dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async deleteMany(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    throw new Error(
      `Cannot delete from dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async deleteOne(
    collectionName: string,
    query: QuerySelection,
    options?: any
  ): Promise<QueryPersistResult> {
    throw new Error(
      `Cannot delete from dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async drop(collectionName: string): Promise<any> {
    throw new Error(
      `Cannot drop collections on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  /**
   * Creating indexes on dynamic datasources should be done via ModelManager.initDynamicRepo()
   */
  async createIndex(
    collectionName: string,
    spec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    throw new Error(
      `Cannot create indexes on dynamic datasource at startup. Call ModelManager.initDynamicRepo() or initDynamicReposForDataSource() when the datasource context is available.`
    )
  }

  async dropIndex(collectionName: string, indexName: string): Promise<any> {
    throw new Error(
      `Cannot drop indexes on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async dropIndexes(collectionName: string): Promise<any> {
    throw new Error(
      `Cannot drop indexes on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async transactionStart(): Promise<void> {
    throw new Error(
      `Cannot start transactions on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async transactionCommit(): Promise<void> {
    throw new Error(
      `Cannot commit transactions on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }

  async transactionRollback(): Promise<void> {
    throw new Error(
      `Cannot rollback transactions on dynamic datasource directly. Use repo methods with DataSourceContext`
    )
  }
}

export default DataSourceDynamic
