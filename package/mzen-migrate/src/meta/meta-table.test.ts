import { MetaTable, MetaRecord } from "./meta-table";
import {
  BulkWriteOp,
  DataSourceInterface,
  QueryPersistResultBulk,
  QuerySelection,
  QuerySelectionOptions,
} from "@datacapy/om/dist/data-source";

/**
 * Enhanced mock datasource for testing MetaTable
 * Simulates a real database with in-memory storage
 */
class TestDataSource implements DataSourceInterface {
  private collections: Map<string, any[]> = new Map();
  private indexes: Map<string, Set<string>> = new Map();
  private counters: Map<string, number> = new Map();
  private transactionActive = false;

  async connect(): Promise<DataSourceInterface> {
    return this;
  }

  async find(
    collectionName: string,
    query: QuerySelection = {},
    options: QuerySelectionOptions = {},
  ): Promise<any[]> {
    const collection = this.collections.get(collectionName) || [];
    let results = collection.filter((doc) => this.matchesQuery(doc, query));

    // Apply sorting
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField];
      results.sort((a, b) => {
        if (a[sortField] < b[sortField]) return sortOrder === 1 ? -1 : 1;
        if (a[sortField] > b[sortField]) return sortOrder === 1 ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findOne(
    collectionName: string,
    query: QuerySelection = {},
    options: QuerySelectionOptions = {},
  ): Promise<any> {
    const results = await this.find(collectionName, query, {
      ...options,
      limit: 1,
    });
    return results[0];
  }

  async findGroup(): Promise<any[]> {
    return [];
  }

  async count(
    collectionName: string,
    query: QuerySelection = {},
    options: QuerySelectionOptions = {},
  ): Promise<number> {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection ${collectionName} does not exist`);
    }

    const collection = this.collections.get(collectionName) || [];
    return collection.filter((doc) => this.matchesQuery(doc, query)).length;
  }

  async groupCount(): Promise<Array<{ _id: any; count: number }>> {
    return [];
  }

  async insertOne(collectionName: string, doc: any): Promise<any> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }

    // Check unique indexes
    const indexKey = `${collectionName}:version`;
    if (this.indexes.has(indexKey)) {
      const collection = this.collections.get(collectionName) || [];
      const existing = collection.find((d) => d.version === doc.version);
      if (existing) {
        throw new Error(
          `Duplicate key error: version ${doc.version} already exists`,
        );
      }
    }

    const collection = this.collections.get(collectionName)!;
    collection.push({ ...doc });

    return { count: 1, id: doc._id || collection.length };
  }

  async insertMany(collectionName: string, docs: any[]): Promise<any> {
    for (const doc of docs) {
      await this.insertOne(collectionName, doc);
    }
    return { count: docs.length, ids: docs.map((_, i) => i) };
  }

  async updateOne(): Promise<any> {
    return { count: 1 };
  }

  async updateMany(): Promise<any> {
    return { count: 0 };
  }

  async upsertOne(): Promise<any> {
    return { count: 1, upsertedCount: 0 };
  }

  async upsertMany(): Promise<any> {
    return { count: 0, upsertedCount: 0 };
  }

  async deleteOne(collectionName: string, query: QuerySelection): Promise<any> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      return { count: 0 };
    }

    const index = collection.findIndex((doc) => this.matchesQuery(doc, query));
    if (index !== -1) {
      collection.splice(index, 1);
      return { count: 1 };
    }

    return { count: 0 };
  }

  async deleteMany(
    collectionName: string,
    query: QuerySelection,
  ): Promise<any> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      return { count: 0 };
    }

    const initialLength = collection.length;
    const remaining = collection.filter(
      (doc) => !this.matchesQuery(doc, query),
    );
    this.collections.set(collectionName, remaining);

    return { count: initialLength - remaining.length };
  }

  async incrementCounter(
    collectionName: string,
    counterName: string,
  ): Promise<number> {
    const key = `${collectionName}:${counterName}`;
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async bulkWrite(
    collectionName: string,
    ops: BulkWriteOp[],
  ): Promise<QueryPersistResultBulk> {
    const result: QueryPersistResultBulk = {
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      insertedIds: {},
      upsertedIds: {},
    };

    for (let index = 0; index < ops.length; index++) {
      const op = ops[index];
      if ("insertOne" in op) {
        const r = await this.insertOne(collectionName, op.insertOne.document);
        result.insertedCount += r.count;
        result.insertedIds[index] = r.id;
      } else if ("updateOne" in op) {
        const r = await this.updateOne();
        result.matchedCount += r.count;
        result.modifiedCount += r.count;
      } else if ("updateMany" in op) {
        const r = await this.updateMany();
        result.matchedCount += r.count;
        result.modifiedCount += r.count;
      } else if ("deleteOne" in op) {
        const r = await this.deleteOne(collectionName, op.deleteOne.filter);
        result.deletedCount += r.count;
      } else if ("deleteMany" in op) {
        const r = await this.deleteMany(collectionName, op.deleteMany.filter);
        result.deletedCount += r.count;
      } else {
        throw new Error("Unsupported bulkWrite operation");
      }
    }

    return result;
  }

  async drop(collectionName: string): Promise<void> {
    this.collections.delete(collectionName);
  }

  async createIndex(
    collectionName: string,
    spec: any,
    options?: any,
  ): Promise<void> {
    if (options?.unique) {
      const field = Object.keys(spec)[0];
      const indexKey = `${collectionName}:${field}`;
      this.indexes.set(indexKey, new Set());
    }
  }

  async dropIndex(): Promise<void> {}

  async dropIndexes(): Promise<void> {}

  async transactionStart(): Promise<DataSourceInterface> {
    this.transactionActive = true;
    return this;
  }

  async transactionCommit(): Promise<void> {
    this.transactionActive = false;
  }

  async transactionRollback(): Promise<void> {
    this.transactionActive = false;
  }

  async close(): Promise<void> {}

  private matchesQuery(doc: any, query: QuerySelection): boolean {
    if (!query || Object.keys(query).length === 0) {
      return true;
    }

    for (const [key, value] of Object.entries(query)) {
      if (doc[key] !== value) {
        return false;
      }
    }

    return true;
  }
}

describe("MetaTable", () => {
  let dataSource: TestDataSource;
  let metaTable: MetaTable;

  beforeEach(() => {
    dataSource = new TestDataSource();
    metaTable = new MetaTable(dataSource, "migrationMeta");
  });

  describe("initialize", () => {
    it("should create meta table on first initialization", async () => {
      await metaTable.initialize();

      // Should be able to count records
      const count = await dataSource.count("migrationMeta");
      expect(count).toBe(0);
    });

    it("should handle already initialized table", async () => {
      await metaTable.initialize();
      await metaTable.initialize(); // Second call should not throw

      const count = await dataSource.count("migrationMeta");
      expect(count).toBe(0);
    });
  });

  describe("getCurrentVersion", () => {
    it("should return default version when no patches applied", async () => {
      await metaTable.initialize();

      const version = await metaTable.getCurrentVersion();

      expect(version).toBe("0000-00-00_0000");
    });

    it("should return latest applied patch version", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-01-15_1200", "First patch");
      await metaTable.recordPatch("2024-02-05_1430", "Second patch");
      await metaTable.recordPatch("2024-02-05_1500", "Third patch");

      const version = await metaTable.getCurrentVersion();

      expect(version).toBe("2024-02-05_1500");
    });
  });

  describe("recordPatch", () => {
    it("should record a patch with all metadata", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-02-05_1430", "Test patch", 1500);

      const patches = await metaTable.getAppliedPatches();
      expect(patches).toHaveLength(1);
      expect(patches[0].version).toBe("2024-02-05_1430");
      expect(patches[0].description).toBe("Test patch");
      expect(patches[0].duration).toBe(1500);
      expect(patches[0].appliedAt).toBeInstanceOf(Date);
    });

    it("should record multiple patches", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-01-15_1200", "First");
      await metaTable.recordPatch("2024-02-05_1430", "Second");

      const patches = await metaTable.getAppliedPatches();
      expect(patches).toHaveLength(2);
    });

    it("should prevent duplicate version records", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-02-05_1430", "Test patch");

      // Attempting to record same version again should throw
      await expect(
        metaTable.recordPatch("2024-02-05_1430", "Duplicate"),
      ).rejects.toThrow("Duplicate key error");
    });
  });

  describe("getAppliedPatches", () => {
    it("should return empty array when no patches applied", async () => {
      await metaTable.initialize();

      const patches = await metaTable.getAppliedPatches();

      expect(patches).toEqual([]);
    });

    it("should return patches in chronological order", async () => {
      await metaTable.initialize();

      // Insert in non-chronological order
      await metaTable.recordPatch("2024-02-05_1500", "Third");
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      await metaTable.recordPatch("2024-01-15_1200", "First");
      await new Promise((resolve) => setTimeout(resolve, 10));
      await metaTable.recordPatch("2024-02-05_1430", "Second");

      const patches = await metaTable.getAppliedPatches();

      expect(patches).toHaveLength(3);
      // Should be sorted by appliedAt, not version
      expect(patches[0].version).toBe("2024-02-05_1500");
      expect(patches[1].version).toBe("2024-01-15_1200");
      expect(patches[2].version).toBe("2024-02-05_1430");
    });
  });

  describe("isPatchApplied", () => {
    it("should return false for unapplied patch", async () => {
      await metaTable.initialize();

      const isApplied = await metaTable.isPatchApplied("2024-02-05_1430");

      expect(isApplied).toBe(false);
    });

    it("should return true for applied patch", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-02-05_1430", "Test patch");

      const isApplied = await metaTable.isPatchApplied("2024-02-05_1430");

      expect(isApplied).toBe(true);
    });
  });

  describe("getAppliedPatchCount", () => {
    it("should return zero when no patches applied", async () => {
      await metaTable.initialize();

      const count = await metaTable.getAppliedPatchCount();

      expect(count).toBe(0);
    });

    it("should return correct count", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-01-15_1200", "First");
      await metaTable.recordPatch("2024-02-05_1430", "Second");
      await metaTable.recordPatch("2024-02-05_1500", "Third");

      const count = await metaTable.getAppliedPatchCount();

      expect(count).toBe(3);
    });
  });

  describe("deletePatchRecord", () => {
    it("should delete specific patch record", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-01-15_1200", "First");
      await metaTable.recordPatch("2024-02-05_1430", "Second");

      await metaTable.deletePatchRecord("2024-01-15_1200");

      const patches = await metaTable.getAppliedPatches();
      expect(patches).toHaveLength(1);
      expect(patches[0].version).toBe("2024-02-05_1430");
    });
  });

  describe("clearAll", () => {
    it("should delete all patch records", async () => {
      await metaTable.initialize();

      await metaTable.recordPatch("2024-01-15_1200", "First");
      await metaTable.recordPatch("2024-02-05_1430", "Second");

      await metaTable.clearAll();

      const count = await metaTable.getAppliedPatchCount();
      expect(count).toBe(0);
    });
  });

  describe("custom table name", () => {
    it("should use custom table name", async () => {
      const customMetaTable = new MetaTable(dataSource, "customMeta");

      await customMetaTable.initialize();
      await customMetaTable.recordPatch("2024-02-05_1430", "Test");

      const count = await dataSource.count("customMeta");
      expect(count).toBe(1);
    });
  });
});
