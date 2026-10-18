import { SchemaEncryptionService } from '@datacapy/schema'
import Repo from '../repo'

export interface EncryptionReencryptorOptions {
  batchSize?: number
  dryRun?: boolean
  /** Resume after this `_id` (the `lastId` of an earlier run). */
  afterId?: unknown
  /** Stop after this many batches; the report's `lastId` resumes from there. */
  maxBatches?: number
  context?: unknown
}

export interface EncryptionReencryptorReport {
  scanned: number
  rewrapped: number
  skipped: number
  failed: number
  /** Count of encrypted values per key id, as found before this run changed them. */
  byKid: Record<string, number>
  lastId: unknown
  /** True when the whole collection was covered. */
  done: boolean
}

interface PendingChange {
  path: string
  before: string
  after: string
}

const DEFAULT_BATCH_SIZE = 100

/**
 * Re-wraps every encrypted field of a repo under the service's active key.
 *
 * Reads and writes the raw stored values straight through the data source, so
 * nothing is decrypted and nothing is encrypted twice. A document is written
 * only when all its encrypted fields rewrapped, and only if they still hold the
 * values that were read, so a concurrent edit is never overwritten. Safe to
 * run repeatedly and to resume through `afterId`.
 */
export class EncryptionReencryptor {
  constructor(
    private repo: Repo<any>,
    private service: SchemaEncryptionService & {
      keyIdOf?: (ciphertext: string) => string | null
    }
  ) {
    if (!service.rewrap) {
      throw new Error('Encryption service does not support rewrap')
    }
  }

  async run(
    options: EncryptionReencryptorOptions = {}
  ): Promise<EncryptionReencryptorReport> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
    const report: EncryptionReencryptorReport = {
      scanned: 0,
      rewrapped: 0,
      skipped: 0,
      failed: 0,
      byKid: {},
      lastId: options.afterId,
      done: false,
    }

    this.repo.initSchema()
    const collection = this.repo.config.collectionName
    const dataSource = await this.repo.getDataSource(options.context as any)
    try {
      for (let batch = 0; ; batch++) {
        if (options.maxBatches !== undefined && batch >= options.maxBatches) {
          return report
        }
        const query =
          report.lastId === undefined ? {} : { _id: { $gt: report.lastId } }
        const docs = await dataSource.find(collection, query, {
          sort: { _id: 1 },
          limit: batchSize,
        })
        if (!docs.length) {
          report.done = true
          return report
        }
        for (const doc of docs) {
          report.scanned++
          await this.processDocument(
            dataSource,
            collection,
            doc,
            report,
            options
          )
        }
        report.lastId = docs[docs.length - 1]._id
        if (docs.length < batchSize) {
          report.done = true
          return report
        }
      }
    } finally {
      this.repo.releaseDataSource(options.context as any)
    }
  }

  private async processDocument(
    dataSource: Awaited<ReturnType<Repo<any>['getDataSource']>>,
    collection: string,
    doc: Record<string, any>,
    report: EncryptionReencryptorReport,
    options: EncryptionReencryptorOptions
  ): Promise<void> {
    let changes: PendingChange[]
    try {
      changes = await this.collectChanges(doc, report)
    } catch {
      report.failed++
      return
    }
    if (!changes.length) {
      report.skipped++
      return
    }
    if (options.dryRun) {
      report.rewrapped++
      return
    }

    const filter: Record<string, unknown> = { _id: doc._id }
    const $set: Record<string, string> = {}
    for (const change of changes) {
      filter[change.path] = change.before
      $set[change.path] = change.after
    }
    try {
      const result = await dataSource.updateOne(collection, filter, { $set })
      if (result.count > 0) report.rewrapped++
      else report.skipped++
    } catch {
      report.failed++
    }
  }

  private async collectChanges(
    doc: Record<string, any>,
    report: EncryptionReencryptorReport
  ): Promise<PendingChange[]> {
    const found: { path: string; value: string }[] = []
    this.repo.schema.getMapper().iterate(doc, (opts) => {
      const { spec, fieldName, container, path } = opts
      if (!spec?.$filter?.encrypt) return
      const value = container?.[fieldName]
      if (value == null || value === '') return
      found.push({ path, value: String(value) })
    })

    const changes: PendingChange[] = []
    const kids: string[] = []
    for (const { path, value } of found) {
      const after = await this.service.rewrap!(value)
      const kid = this.service.keyIdOf?.(value)
      if (kid) kids.push(kid)
      if (after !== null) changes.push({ path, before: value, after })
    }
    // Count only once the whole document rewrapped, so a failed one adds nothing.
    for (const kid of kids) report.byKid[kid] = (report.byKid[kid] ?? 0) + 1
    return changes
  }
}
