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

export interface DataSourceRedisConfig {
  url?: string
  host?: string
  port?: number
  password?: string
  db?: number
  keyPrefix?: string
  options?: Record<string, any>
  /**
   * When false, the per-collection ids SET ({collection}:ids) is not maintained.
   * All write operations still work, but collection-scan queries (find/count/etc.
   * without an _id filter) return empty results, and drop() uses SCAN instead of
   * smembers. Use false for id-only lookup caches to avoid accumulating stale ids.
   * Defaults to true.
   */
  trackIds?: boolean
}

export interface DataSourceRedisStats {
  connected: boolean
  keys: number
  memory: string
}

type Redis = any

export class DataSourceRedis implements DataSourceInterface {
  protected config: DataSourceRedisConfig
  private client: Redis
  private pipeline: Redis | null = null
  private subscriber: Redis | null = null
  public connected: boolean = false

  constructor(config: DataSourceRedisConfig) {
    this.config = config ?? {}
    this.client = null
  }

  async connect(): Promise<DataSourceInterface> {
    try {
      require.resolve('ioredis')
    } catch (e) {
      console.error('DataSourceRedis requires "ioredis" module to be installed')
      process.exit()
    }

    const IORedis = require('ioredis')
    // Exclude trackIds — it is not an ioredis option
    const {
      url,
      options: extraOptions,
      keyPrefix,
      trackIds: _trackIds,
      ...rest
    } = this.config
    const connectOptions = {
      keyPrefix,
      ...extraOptions,
      ...(url ? {} : rest),
    }

    this.client = url
      ? new IORedis(url, connectOptions)
      : new IORedis(connectOptions)

    this.client.on('ready', () => {
      this.connected = true
    })
    this.client.on('error', () => {
      this.connected = false
    })
    this.client.on('close', () => {
      this.connected = false
    })

    return this
  }

  // ─── Key helpers ──────────────────────────────────────────────────────────

  private docKey(collectionName: string, id: string | number): string {
    return `${collectionName}:doc:${id}`
  }

  private idsKey(collectionName: string): string {
    return `${collectionName}:ids`
  }

  // ─── ID pre-filtering ─────────────────────────────────────────────────────

  /**
   * Attempts to extract a targeted set of IDs from the query so that we can
   * fetch only those documents rather than the entire collection.
   *
   * Returns an array of IDs when the query contains an _id equality/in
   * constraint that is reachable from the root by traversing $and only.
   * Because $and requires all conditions to be true, an _id constraint found
   * anywhere in the $and chain is a necessary condition — the result set is
   * always a subset of the matched IDs regardless of any sibling $or clauses.
   *
   * Returns null when no such optimisation is possible and a full collection
   * scan is required (e.g. _id is only reachable through $or, or is absent).
   */
  private extractIdFilter(query?: QuerySelection): (string | number)[] | null {
    if (!query) return null
    return this.findRequiredIdConstraint(query)
  }

  /**
   * Recursively searches for an _id constraint by following $and edges only.
   * Never descends into $or — conditions inside $or are not guaranteed to hold.
   */
  private findRequiredIdConstraint(
    query: QuerySelection
  ): (string | number)[] | null {
    // Direct _id at this level
    const idClause = query['_id']
    if (idClause !== undefined) {
      if (
        idClause !== null &&
        typeof idClause === 'object' &&
        !Array.isArray(idClause)
      ) {
        if (Array.isArray(idClause['$in'])) return idClause['$in']
        if (idClause['$eq'] !== undefined) return [idClause['$eq']]
        return null
      }
      // bare value: { _id: 'abc' }
      return [idClause]
    }

    // Traverse $and — all members are required conditions
    if (Array.isArray(query['$and'])) {
      for (const clause of query['$and'] as QuerySelection[]) {
        const found = this.findRequiredIdConstraint(clause)
        if (found !== null) return found
      }
    }

    return null
  }

  // ─── Document loading ─────────────────────────────────────────────────────

  private async loadDocs(
    collectionName: string,
    query?: QuerySelection
  ): Promise<Record<string, any>[]> {
    const targetIds = this.extractIdFilter(query)

    // When id tracking is disabled, full-collection scans are not supported
    if (!targetIds && this.config.trackIds === false) return []

    const ids: (string | number)[] = targetIds
      ? targetIds
      : await this.client.smembers(this.idsKey(collectionName))

    if (ids.length === 0) return []

    const keys = ids.map((id) => this.docKey(collectionName, id))
    const raw: (string | null)[] = await this.client.mget(...keys)

    const docs: Record<string, any>[] = []
    for (const str of raw) {
      if (str !== null) docs.push(JSON.parse(str))
    }
    return docs
  }

  // ─── In-memory query matching ─────────────────────────────────────────────

  private matchesQuery(
    doc: Record<string, any>,
    query?: QuerySelection
  ): boolean {
    if (!query) return true

    if (query['$or']) {
      return (query['$or'] as QuerySelection[]).some((c) =>
        this.matchesQuery(doc, c)
      )
    }

    if (query['$and']) {
      return (query['$and'] as QuerySelection[]).every((c) =>
        this.matchesQuery(doc, c)
      )
    }

    for (const key of Object.keys(query)) {
      if (key === '$or' || key === '$and') continue

      const clause = query[key]
      const docValue = this.getNestedValue(doc, key)

      if (
        clause !== null &&
        typeof clause === 'object' &&
        !Array.isArray(clause)
      ) {
        if (!this.matchesOperators(docValue, clause)) return false
      } else {
        if (docValue !== clause) return false
      }
    }
    return true
  }

  private getNestedValue(doc: Record<string, any>, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], doc)
  }

  private matchesOperators(
    value: any,
    operators: Record<string, any>
  ): boolean {
    for (const op of Object.keys(operators)) {
      const operand = operators[op]
      switch (op) {
        case '$eq':
          if (value !== operand) return false
          break
        case '$ne':
          if (value === operand) return false
          break
        case '$gt':
          if (!(value > operand)) return false
          break
        case '$gte':
          if (!(value >= operand)) return false
          break
        case '$lt':
          if (!(value < operand)) return false
          break
        case '$lte':
          if (!(value <= operand)) return false
          break
        case '$in':
          if (!(operand as any[]).includes(value)) return false
          break
        case '$nin':
          if ((operand as any[]).includes(value)) return false
          break
        case '$exists':
          if (operand && value === undefined) return false
          if (!operand && value !== undefined) return false
          break
        case '$like': {
          const pattern = (operand as string)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*')
            .replace(/_/g, '.')
          if (!new RegExp(`^${pattern}$`, 'i').test(String(value ?? '')))
            return false
          break
        }
        case '$not':
          if (this.matchesOperators(value, operand)) return false
          break
        default:
          break
      }
    }
    return true
  }

  // ─── In-memory sort / skip / limit / fields ────────────────────────────────

  private applyOptions(
    docs: Record<string, any>[],
    options: QuerySelectionOptions
  ): Record<string, any>[] {
    let result = docs

    if (options.sort) {
      const sortEntries = Object.entries(options.sort)
      result = [...result].sort((a, b) => {
        for (const [field, dir] of sortEntries) {
          const av = this.getNestedValue(a, field)
          const bv = this.getNestedValue(b, field)
          if (av < bv) return dir === 1 ? -1 : 1
          if (av > bv) return dir === 1 ? 1 : -1
        }
        return 0
      })
    }

    if (options.skip) result = result.slice(options.skip)
    if (options.limit) result = result.slice(0, options.limit)

    if (options.fields) {
      const include = Object.entries(options.fields)
        .filter(([, v]) => v === 1)
        .map(([k]) => k)
      const exclude = Object.entries(options.fields)
        .filter(([, v]) => v === 0)
        .map(([k]) => k)
      if (include.length > 0) {
        result = result.map((doc) => {
          const out: Record<string, any> = {}
          for (const f of include) out[f] = doc[f]
          return out
        })
      } else if (exclude.length > 0) {
        result = result.map((doc) => {
          const out = { ...doc }
          for (const f of exclude) delete out[f]
          return out
        })
      }
    }

    return result
  }

  // ─── Read operations ──────────────────────────────────────────────────────

  async find(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string, any>[]> {
    const docs = await this.loadDocs(collectionName, query)
    const filtered = docs.filter((doc) => this.matchesQuery(doc, query))
    return this.applyOptions(filtered, options ?? {})
  }

  async findOne(
    collectionName: string,
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string, any>> {
    const results = await this.find(collectionName, query, {
      ...options,
      limit: 1,
    })
    return results[0] ?? null
  }

  async findGroup(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection,
    options?: QuerySelectionOptions
  ): Promise<Record<string, any>[]> {
    const docs = await this.find(collectionName, query, options)
    const seen = new Map<string, Record<string, any>>()
    for (const doc of docs) {
      const key = groupFields.map((f) => this.getNestedValue(doc, f)).join('::')
      if (!seen.has(key)) seen.set(key, doc)
    }
    return Array.from(seen.values())
  }

  async count(
    collectionName: string,
    query?: QuerySelection,
    _options?: QuerySelectionOptions
  ): Promise<number> {
    const docs = await this.loadDocs(collectionName, query)
    return docs.filter((doc) => this.matchesQuery(doc, query)).length
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    const docs = await this.loadDocs(collectionName, query)
    const filtered = docs.filter((doc) => this.matchesQuery(doc, query))
    const counts = new Map<
      string,
      { _id: Record<string, any>; count: number }
    >()
    for (const doc of filtered) {
      const id: Record<string, any> = {}
      for (const f of groupFields) id[f] = this.getNestedValue(doc, f)
      const key = JSON.stringify(id)
      if (counts.has(key)) {
        counts.get(key).count++
      } else {
        counts.set(key, { _id: id, count: 1 })
      }
    }
    return Array.from(counts.values())
  }

  // ─── Write operations ─────────────────────────────────────────────────────

  private getWriter(): Redis {
    return this.pipeline ?? this.client
  }

  async insertMany(
    collectionName: string,
    docs: any[],
    _options?: any
  ): Promise<QueryPersistResultInsertMany> {
    const writer = this.getWriter()
    const ids: Record<number, any> = {}
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      const id = doc._id
      ids[i] = id
      writer.set(this.docKey(collectionName, id), JSON.stringify(doc))
      if (this.config.trackIds !== false) {
        writer.sadd(this.idsKey(collectionName), String(id))
      }
      this.applyTtlIfConfigured(writer, collectionName, id)
    }
    return { count: docs.length, ids }
  }

  async insertOne(
    collectionName: string,
    doc: any,
    _options?: any
  ): Promise<QueryPersistResultInsertOne> {
    const id = doc._id
    const writer = this.getWriter()
    writer.set(this.docKey(collectionName, id), JSON.stringify(doc))
    if (this.config.trackIds !== false) {
      writer.sadd(this.idsKey(collectionName), String(id))
    }
    this.applyTtlIfConfigured(writer, collectionName, id)
    return { count: 1, id }
  }

  private applyUpdate(
    doc: Record<string, any>,
    queryUpdate: QueryUpdate
  ): void {
    if (queryUpdate.$set) {
      for (const [path, value] of Object.entries(queryUpdate.$set)) {
        this.setNestedValue(doc, path, value)
      }
    }
    if (queryUpdate.$unset) {
      for (const path of Object.keys(queryUpdate.$unset)) {
        this.unsetNestedValue(doc, path)
      }
    }
    if (queryUpdate.$inc) {
      for (const [path, delta] of Object.entries(queryUpdate.$inc)) {
        const current = this.getNestedValue(doc, path) ?? 0
        this.setNestedValue(doc, path, current + delta)
      }
    }
    if (queryUpdate.$mul) {
      for (const [path, factor] of Object.entries(queryUpdate.$mul)) {
        const current = this.getNestedValue(doc, path) ?? 0
        this.setNestedValue(doc, path, current * factor)
      }
    }
    if (queryUpdate.$min) {
      for (const [path, value] of Object.entries(queryUpdate.$min)) {
        const current = this.getNestedValue(doc, path)
        if (current === undefined || value < current)
          this.setNestedValue(doc, path, value)
      }
    }
    if (queryUpdate.$max) {
      for (const [path, value] of Object.entries(queryUpdate.$max)) {
        const current = this.getNestedValue(doc, path)
        if (current === undefined || value > current)
          this.setNestedValue(doc, path, value)
      }
    }
  }

  private setNestedValue(
    doc: Record<string, any>,
    path: string,
    value: any
  ): void {
    const parts = path.split('.')
    let obj = doc
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === undefined) obj[parts[i]] = {}
      obj = obj[parts[i]]
    }
    obj[parts[parts.length - 1]] = value
  }

  private unsetNestedValue(doc: Record<string, any>, path: string): void {
    const parts = path.split('.')
    let obj = doc
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === undefined) return
      obj = obj[parts[i]]
    }
    delete obj[parts[parts.length - 1]]
  }

  async updateMany(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    _options?: any
  ): Promise<QueryPersistResult> {
    const docs = await this.loadDocs(collectionName, querySelect)
    const matching = docs.filter((doc) => this.matchesQuery(doc, querySelect))
    const writer = this.getWriter()
    for (const doc of matching) {
      this.applyUpdate(doc, queryUpdate)
      writer.set(this.docKey(collectionName, doc._id), JSON.stringify(doc))
      this.applyTtlIfConfigured(writer, collectionName, doc._id)
    }
    return { count: matching.length }
  }

  async updateOne(
    collectionName: string,
    querySelect: QuerySelection,
    queryUpdate: QueryUpdate,
    _options?: any
  ): Promise<QueryPersistResult> {
    const docs = await this.loadDocs(collectionName, querySelect)
    const match = docs.find((doc) => this.matchesQuery(doc, querySelect))
    if (!match) return { count: 0 }
    this.applyUpdate(match, queryUpdate)
    const writer = this.getWriter()
    writer.set(this.docKey(collectionName, match._id), JSON.stringify(match))
    this.applyTtlIfConfigured(writer, collectionName, match._id)
    return { count: 1 }
  }

  async upsertMany(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    _options?: any
  ): Promise<QueryPersistResultUpsert> {
    const docs = await this.loadDocs(collectionName, filter)
    const matching = docs.filter((doc) => this.matchesQuery(doc, filter))
    if (matching.length > 0) {
      const writer = this.getWriter()
      for (const doc of matching) {
        this.applyUpdate(doc, update)
        writer.set(this.docKey(collectionName, doc._id), JSON.stringify(doc))
        this.applyTtlIfConfigured(writer, collectionName, doc._id)
      }
      return { count: matching.length, upsertedCount: 0 }
    }
    const insertDoc = {
      ...this._extractEqualityFields(filter),
      ...(update.$set ?? {}),
      ...(update.$setOnInsert ?? {}),
    }
    const insertResult = await this.insertOne(
      collectionName,
      insertDoc,
      _options
    )
    return {
      count: insertResult.count,
      upsertedCount: insertResult.count,
      upsertedId: insertResult.id,
    }
  }

  async upsertOne(
    collectionName: string,
    filter: QuerySelection,
    update: QueryUpdate,
    _options?: any
  ): Promise<QueryPersistResultUpsert> {
    const docs = await this.loadDocs(collectionName, filter)
    const match = docs.find((doc) => this.matchesQuery(doc, filter))
    if (match) {
      this.applyUpdate(match, update)
      const writer = this.getWriter()
      writer.set(this.docKey(collectionName, match._id), JSON.stringify(match))
      this.applyTtlIfConfigured(writer, collectionName, match._id)
      return { count: 1, upsertedCount: 0 }
    }
    const insertDoc = {
      ...this._extractEqualityFields(filter),
      ...(update.$set ?? {}),
      ...(update.$setOnInsert ?? {}),
    }
    const insertResult = await this.insertOne(
      collectionName,
      insertDoc,
      _options
    )
    return {
      count: insertResult.count,
      upsertedCount: insertResult.count,
      upsertedId: insertResult.id,
    }
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

  async deleteMany(
    collectionName: string,
    query: QuerySelection,
    _options?: any
  ): Promise<QueryPersistResult> {
    const docs = await this.loadDocs(collectionName, query)
    const matching = docs.filter((doc) => this.matchesQuery(doc, query))
    const writer = this.getWriter()
    for (const doc of matching) {
      writer.del(this.docKey(collectionName, doc._id))
      if (this.config.trackIds !== false) {
        writer.srem(this.idsKey(collectionName), String(doc._id))
      }
    }
    return { count: matching.length }
  }

  async deleteOne(
    collectionName: string,
    query: QuerySelection,
    _options?: any
  ): Promise<QueryPersistResult> {
    const docs = await this.loadDocs(collectionName, query)
    const match = docs.find((doc) => this.matchesQuery(doc, query))
    if (!match) return { count: 0 }
    const writer = this.getWriter()
    writer.del(this.docKey(collectionName, match._id))
    if (this.config.trackIds !== false) {
      writer.srem(this.idsKey(collectionName), String(match._id))
    }
    return { count: 1 }
  }

  // Reuses the existing pipeline/getWriter/transactionStart mechanism. If a transaction is
  // already open on this instance (caller already called transactionStart()), ops are queued
  // onto that ambient pipeline and this method does not commit/rollback it - that remains the
  // caller's responsibility. Otherwise bulkWrite opens and owns its own local transaction for
  // the duration of the call.
  // Caveat (pre-existing, not new to bulkWrite): loadDocs() inside updateOne/updateMany/
  // deleteOne/deleteMany/upsert* reads via this.client, not the pending pipeline, so a later op
  // in the same batch will not see an earlier op's write until after EXEC.
  async bulkWrite(
    collectionName: string,
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

    const ownsTransaction = !this.pipeline
    if (ownsTransaction) {
      await this.transactionStart()
    }

    try {
      for (let index = 0; index < ops.length; index++) {
        const op = ops[index]
        if ('insertOne' in op) {
          const r = await this.insertOne(
            collectionName,
            op.insertOne.document,
            options
          )
          result.insertedCount += r.count
          result.insertedIds[index] = r.id
        } else if ('updateOne' in op) {
          const r = await this.updateOne(
            collectionName,
            op.updateOne.filter,
            op.updateOne.update,
            options
          )
          result.matchedCount += r.count
          result.modifiedCount += r.count
        } else if ('updateMany' in op) {
          const r = await this.updateMany(
            collectionName,
            op.updateMany.filter,
            op.updateMany.update,
            options
          )
          result.matchedCount += r.count
          result.modifiedCount += r.count
        } else if ('deleteOne' in op) {
          const r = await this.deleteOne(
            collectionName,
            op.deleteOne.filter,
            options
          )
          result.deletedCount += r.count
        } else if ('deleteMany' in op) {
          const r = await this.deleteMany(
            collectionName,
            op.deleteMany.filter,
            options
          )
          result.deletedCount += r.count
        } else {
          throw new Error('Unsupported bulkWrite operation')
        }
      }
    } catch (err) {
      if (ownsTransaction) {
        await this.transactionRollback()
      }
      throw err
    }

    if (ownsTransaction) {
      await this.transactionCommit()
    }

    return result
  }

  // ─── Collection operations ────────────────────────────────────────────────

  async drop(collectionName: string): Promise<any> {
    if (this.config.trackIds === false) {
      // ids SET not maintained — find doc keys via SCAN instead
      const keys = await this.scanKeys(`${collectionName}:doc:*`)
      if (keys.length > 0) await this.client.del(...keys)
      return
    }
    const ids: string[] = await this.client.smembers(
      this.idsKey(collectionName)
    )
    if (ids.length > 0) {
      const keys = ids.map((id) => this.docKey(collectionName, id))
      await this.client.del(...keys)
    }
    await this.client.del(this.idsKey(collectionName))
  }

  /**
   * Scans for all Redis keys matching `pattern` (without keyPrefix).
   * Handles keyPrefix transparently: prepends it to the MATCH argument and
   * strips it from returned keys so callers can pass unprefixed patterns and
   * receive unprefixed keys suitable for subsequent client calls.
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const prefix: string = this.client.options?.keyPrefix ?? ''
    const scanPattern = `${prefix}${pattern}`
    const keys: string[] = []
    let cursor = '0'
    do {
      const result: [string, string[]] = await this.client.scan(
        cursor,
        'MATCH',
        scanPattern,
        'COUNT',
        100
      )
      cursor = result[0]
      for (const key of result[1]) {
        keys.push(
          prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
        )
      }
    } while (cursor !== '0')
    return keys
  }

  // ─── Index operations ─────────────────────────────────────────────────────
  //
  // Redis has no native document indexes. We honour expireAfterSeconds by
  // recording the TTL and applying it to each document key on insert/update.
  // Other index options are accepted but ignored.

  private ttlByCollection = new Map<string, number>()

  async createIndex(
    collectionName: string,
    _spec: IndexSpec | string,
    options?: IndexOptions
  ): Promise<any> {
    if (options?.expireAfterSeconds !== undefined) {
      this.ttlByCollection.set(collectionName, options.expireAfterSeconds)
    }
  }

  async dropIndex(_collectionName: string, _indexName: string): Promise<any> {}

  async dropIndexes(collectionName: string): Promise<any> {
    this.ttlByCollection.delete(collectionName)
  }

  private applyTtlIfConfigured(
    writer: Redis,
    collectionName: string,
    id: string | number
  ): void {
    const ttl = this.ttlByCollection.get(collectionName)
    if (ttl !== undefined) {
      writer.expire(this.docKey(collectionName, id), ttl)
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(): Promise<DataSourceRedisStats> {
    try {
      const memory: string = await this.client.info('memory')
      const memMatch = memory.match(/used_memory_human:(.+)/)
      const memUsed = memMatch ? memMatch[1].trim() : 'unknown'
      const keys = await this.scanKeys('*')
      return { connected: this.connected, keys: keys.length, memory: memUsed }
    } catch {
      return { connected: this.connected, keys: 0, memory: 'unknown' }
    }
  }

  // ─── Raw client access ────────────────────────────────────────────────────

  /**
   * Runs a Lua script against the underlying ioredis client via EVAL.
   * Exposed for callers that need atomic multi-command operations (e.g. rate
   * limiting) that this data source's document API does not model.
   */
  async eval(script: string, numKeys: number, ...args: string[]): Promise<any> {
    return this.client.eval(script, numKeys, ...args)
  }

  // ─── Pub / Sub ────────────────────────────────────────────────────────────

  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message))
  }

  /**
   * Subscribes to a Redis pub/sub channel. Creates a dedicated subscriber
   * connection on first call (ioredis connections in subscriber mode cannot
   * issue other commands).
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    if (!this.subscriber) {
      const IORedis = require('ioredis')
      // Exclude DataSourceRedis-specific fields before passing to ioredis
      const {
        url,
        options: extraOptions,
        keyPrefix,
        trackIds: _trackIds,
        ...rest
      } = this.config
      const connectOptions = {
        keyPrefix,
        ...extraOptions,
        ...(url ? {} : rest),
      }
      this.subscriber = url
        ? new IORedis(url, connectOptions)
        : new IORedis(connectOptions)
    }
    await this.subscriber.subscribe(channel)
    this.subscriber.on('message', (ch: string, msg: string) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg))
        } catch {
          // ignore malformed messages
        }
      }
    })
  }

  // ─── Database-level operations (no-op for Redis) ──────────────────────────

  async createDatabase(_databaseName: string): Promise<void> {}

  async dropDatabase(_databaseName: string): Promise<void> {}

  // ─── Transactions ─────────────────────────────────────────────────────────

  async transactionStart(): Promise<void> {
    if (this.pipeline) throw new Error('Transaction already in progress')
    this.pipeline = this.client.multi()
  }

  async transactionCommit(): Promise<void> {
    if (!this.pipeline) throw new Error('No transaction in progress')
    await this.pipeline.exec()
    this.pipeline = null
  }

  async transactionRollback(): Promise<void> {
    if (!this.pipeline) throw new Error('No transaction in progress')
    await this.pipeline.discard()
    this.pipeline = null
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
    if (this.subscriber) {
      await this.subscriber.quit()
      this.subscriber = null
    }
  }
}

export default DataSourceRedis
