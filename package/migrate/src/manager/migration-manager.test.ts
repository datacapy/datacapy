import * as path from "path";
import { MigrationManager } from "./migration-manager";
import {
  ModelManager,
  DataSourceInterface,
  BulkWriteOp,
  QueryPersistResultBulk,
} from "@datacapy/om";
import { MigrationConfig } from "../interface/migration-config";

// Enhanced test datasource for migration testing
class TestDataSource implements DataSourceInterface {
  private collections: Map<string, any[]> = new Map();
  private indexes: Map<string, Set<string>> = new Map();
  private counters: Map<string, number> = new Map();

  async connect(): Promise<DataSourceInterface> {
    return this;
  }

  async find(
    collectionName: string,
    query: any = {},
    options: any = {},
  ): Promise<any[]> {
    const collection = this.collections.get(collectionName) || [];
    let results = collection.filter((doc) => this.matchesQuery(doc, query));

    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField];
      results.sort((a, b) => {
        if (a[sortField] < b[sortField]) return sortOrder === 1 ? -1 : 1;
        if (a[sortField] > b[sortField]) return sortOrder === 1 ? 1 : -1;
        return 0;
      });
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findOne(
    collectionName: string,
    query: any = {},
    options: any = {},
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

  async count(collectionName: string, query: any = {}): Promise<number> {
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

  async deleteOne(collectionName: string, query: any): Promise<any> {
    const collection = this.collections.get(collectionName);
    if (!collection) return { count: 0 };

    const index = collection.findIndex((doc) => this.matchesQuery(doc, query));
    if (index !== -1) {
      collection.splice(index, 1);
      return { count: 1 };
    }
    return { count: 0 };
  }

  async deleteMany(collectionName: string, query: any): Promise<any> {
    const collection = this.collections.get(collectionName);
    if (!collection) return { count: 0 };

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
    return this;
  }

  async transactionCommit(): Promise<void> {}

  async transactionRollback(): Promise<void> {}

  async close(): Promise<void> {}

  private matchesQuery(doc: any, query: any): boolean {
    if (!query || Object.keys(query).length === 0) return true;

    for (const [key, value] of Object.entries(query)) {
      if (doc[key] !== value) return false;
    }
    return true;
  }
}

describe("MigrationManager", () => {
  let modelManager: ModelManager;
  let testDataSource: TestDataSource;
  const fixturesPath = path.join(
    __dirname,
    "..",
    "__tests__",
    "fixtures",
    "sample-patches",
  );

  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    testDataSource = new TestDataSource();
    modelManager = new ModelManager({});
    modelManager.addDataSource("db", testDataSource);
    // Add workspace datasource for testing datasource filtering
    modelManager.addDataSource("workspace", new TestDataSource());
    // MigrationManager logs via MigrationLogger, a CLI logger that prints to console by
    // design - suppress its output during tests.
    logSpy = jest.spyOn(console, "log").mockImplementation();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("migrate", () => {
    it("should run complete migration successfully", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager = new MigrationManager(config);
      const result = await manager.migrate();

      expect(result.totalPatches).toBe(3); // Only 'db' patches, not 'workspace'
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.previousVersion).toBe("0000-00-00_0000");
      expect(result.currentVersion).toBe("2024-02-05_1430"); // Latest db patch
      expect(result.dryRun).toBe(false);
    });

    it("should filter patches by datasource name", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "workspace",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager = new MigrationManager(config);
      const result = await manager.migrate();

      expect(result.totalPatches).toBe(1); // Only 'workspace' patch
      expect(result.successCount).toBe(1);
      expect(result.patchResults[0].version).toBe("2024-02-10_0900");
    });

    it("should respect target version", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        targetVersion: "2024-01-20_1430",
        verbose: false,
      };

      const manager = new MigrationManager(config);
      const result = await manager.migrate();

      expect(result.totalPatches).toBe(2); // Only patches up to 2024-01-20_1430
      expect(result.currentVersion).toBe("2024-01-20_1430");
    });

    it("should skip patches in dry-run mode", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        dryRun: true,
        verbose: false,
      };

      const manager = new MigrationManager(config);
      const result = await manager.migrate();

      expect(result.dryRun).toBe(true);
      expect(result.skippedCount).toBe(3);
      expect(result.successCount).toBe(0);
      expect(result.currentVersion).toBe("0000-00-00_0000"); // No changes
    });

    it("should resume from current version", async () => {
      // First migration
      const config1: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        targetVersion: "2024-01-15_1200",
        verbose: false,
      };

      const manager1 = new MigrationManager(config1);
      const result1 = await manager1.migrate();

      expect(result1.totalPatches).toBe(1);
      expect(result1.currentVersion).toBe("2024-01-15_1200");

      // Second migration - should only apply remaining patches
      const config2: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager2 = new MigrationManager(config2);
      const result2 = await manager2.migrate();

      expect(result2.totalPatches).toBe(2); // Remaining patches
      expect(result2.previousVersion).toBe("2024-01-15_1200");
      expect(result2.currentVersion).toBe("2024-02-05_1430");
    });

    it("should handle no patches to apply", async () => {
      // Apply all patches first
      const config1: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager1 = new MigrationManager(config1);
      await manager1.migrate();

      // Run again - no patches to apply
      const manager2 = new MigrationManager(config1);
      const result2 = await manager2.migrate();

      expect(result2.totalPatches).toBe(0);
      expect(result2.previousVersion).toBe("2024-02-05_1430");
      expect(result2.currentVersion).toBe("2024-02-05_1430");
    });

    it("should record patch metadata in meta table", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager = new MigrationManager(config);
      await manager.migrate();

      // Query meta table directly
      const metaRecords = await testDataSource.find("migrationMeta");

      expect(metaRecords).toHaveLength(3);
      expect(metaRecords[0].version).toBe("2024-01-15_1200");
      expect(metaRecords[0].description).toBeDefined();
      expect(metaRecords[0].appliedAt).toBeDefined();
      expect(metaRecords[0].duration).toBeDefined();
    });

    it("should include timing information in results", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager = new MigrationManager(config);
      const result = await manager.migrate();

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.endTime.getTime()).toBeGreaterThanOrEqual(
        result.startTime.getTime(),
      );

      result.patchResults.forEach((pr) => {
        expect(pr.duration).toBeGreaterThanOrEqual(0);
        expect(pr.timestamp).toBeInstanceOf(Date);
      });
    });

    it("should use custom meta table name", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: fixturesPath,
        metaTableName: "customMigrationMeta",
        verbose: false,
      };

      const manager = new MigrationManager(config);
      await manager.migrate();

      const metaRecords = await testDataSource.find("customMigrationMeta");
      expect(metaRecords).toHaveLength(3);
    });

    it("should throw error if datasource not found", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "nonexistent",
        patchDirectory: fixturesPath,
        verbose: false,
      };

      const manager = new MigrationManager(config);

      await expect(manager.migrate()).rejects.toThrow("not found");
    });

    it("should throw error if patch directory does not exist", async () => {
      const config: MigrationConfig = {
        modelManager,
        dataSourceName: "db",
        patchDirectory: "/nonexistent/path",
        verbose: false,
      };

      const manager = new MigrationManager(config);

      await expect(manager.migrate()).rejects.toThrow("does not exist");
    });
  });

  describe("dynamic datasource ref counting", () => {
    // These tests target the reference leak fixed alongside this test suite:
    // resolveDataSource() acquires a dynamic datasource reference that must be
    // released once migrate() is done with it, on both success and error paths.
    const registryKey = "workspace:proj1";
    const dynamicModelManagers: ModelManager[] = [];

    afterEach(async () => {
      for (const manager of dynamicModelManagers.splice(0)) {
        // Drop the pre-seed's own reference, or shutdown waits for it to drain
        manager.dataSourceRegistry!.release(registryKey);
        await manager.shutdown();
      }
    });

    function buildDynamicModelManager() {
      const dynamicModelManager = new ModelManager({
        dynamicDataSource: { enable: true },
      });
      dynamicModelManagers.push(dynamicModelManager);

      // Registry entry is pre-seeded directly so resolveDataSource()'s acquire
      // resolves without needing a real DataSourceLookup/connection. The lookup
      // below must never actually be invoked as a result.
      dynamicModelManager.setDataSourceLookup("workspace", {
        lookup: async () => {
          throw new Error("lookup() should not be called when pre-seeded");
        },
      });

      return dynamicModelManager;
    }

    it("releases the resolveDataSource() reference after a successful migration", async () => {
      const dynamicModelManager = buildDynamicModelManager();
      await dynamicModelManager.dataSourceRegistry!.getOrCreate(
        registryKey,
        async () => new TestDataSource(),
      );

      const config: MigrationConfig = {
        modelManager: dynamicModelManager,
        dataSourceName: "workspace",
        context: { workspaceId: "proj1" },
        patchDirectory: fixturesPath,
        verbose: false,
      };

      await new MigrationManager(config).migrate();

      const entry = dynamicModelManager
        .dataSourceRegistry!.getStats()
        .entries.find((e) => e.key === registryKey);
      expect(entry?.refCount).toBe(1); // back to the pre-seed's own reference
    });

    it("releases the resolveDataSource() reference even when a patch fails", async () => {
      const dynamicModelManager = buildDynamicModelManager();
      await dynamicModelManager.dataSourceRegistry!.getOrCreate(
        registryKey,
        async () => new TestDataSource(),
      );

      const config: MigrationConfig = {
        modelManager: dynamicModelManager,
        dataSourceName: "workspace",
        context: { workspaceId: "proj1" },
        patchDirectory: "/nonexistent/path",
        verbose: false,
      };

      await expect(new MigrationManager(config).migrate()).rejects.toThrow(
        "does not exist",
      );

      const entry = dynamicModelManager
        .dataSourceRegistry!.getStats()
        .entries.find((e) => e.key === registryKey);
      expect(entry?.refCount).toBe(1);
    });
  });
});
