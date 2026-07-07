import { PatchExecutor } from "./patch-executor";
import { DatabasePatchInterface } from "../interface/database-patch";
import { MigrationLogger } from "../logger/migration-logger";
import { ModelManager, DataSourceInterface } from "mzen-om";

// Mock datasource with transaction support
class MockDataSourceWithTransactions implements DataSourceInterface {
  transactionStartCalled = false;
  transactionCommitCalled = false;
  transactionRollbackCalled = false;

  async connect(): Promise<DataSourceInterface> {
    return this;
  }
  async find(): Promise<any[]> {
    return [];
  }
  async findOne(): Promise<any> {
    return null;
  }
  async findGroup(): Promise<any[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async groupCount(): Promise<Array<{ _id: any; count: number }>> {
    return [];
  }
  async insertOne(): Promise<any> {
    return { count: 1, id: 1 };
  }
  async insertMany(): Promise<any> {
    return { count: 0, ids: [] };
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
  async deleteOne(): Promise<any> {
    return { count: 1 };
  }
  async deleteMany(): Promise<any> {
    return { count: 0 };
  }
  async bulkWrite(): Promise<any> {
    return {
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      insertedIds: {},
      upsertedIds: {},
    };
  }
  async drop(): Promise<any> {
    return true;
  }
  async createIndex(): Promise<any> {
    return true;
  }
  async dropIndex(): Promise<any> {
    return true;
  }
  async dropIndexes(): Promise<any> {
    return true;
  }
  async close(): Promise<void> {}

  async transactionStart(): Promise<DataSourceInterface> {
    this.transactionStartCalled = true;
    return this;
  }

  async transactionCommit(): Promise<void> {
    this.transactionCommitCalled = true;
  }

  async transactionRollback(): Promise<void> {
    this.transactionRollbackCalled = true;
  }

  reset() {
    this.transactionStartCalled = false;
    this.transactionCommitCalled = false;
    this.transactionRollbackCalled = false;
  }
}

// Mock datasource without transaction support
class MockDataSourceNoTransactions implements DataSourceInterface {
  async connect(): Promise<DataSourceInterface> {
    return this;
  }
  async find(): Promise<any[]> {
    return [];
  }
  async findOne(): Promise<any> {
    return null;
  }
  async findGroup(): Promise<any[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async groupCount(): Promise<Array<{ _id: any; count: number }>> {
    return [];
  }
  async insertOne(): Promise<any> {
    return { count: 1, id: 1 };
  }
  async insertMany(): Promise<any> {
    return { count: 0, ids: [] };
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
  async deleteOne(): Promise<any> {
    return { count: 1 };
  }
  async deleteMany(): Promise<any> {
    return { count: 0 };
  }
  async bulkWrite(): Promise<any> {
    return {
      insertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedCount: 0,
      insertedIds: {},
      upsertedIds: {},
    };
  }
  async drop(): Promise<any> {
    return true;
  }
  async createIndex(): Promise<any> {
    return true;
  }
  async dropIndex(): Promise<any> {
    return true;
  }
  async dropIndexes(): Promise<any> {
    return true;
  }
  async close(): Promise<void> {}

  async transactionStart(): Promise<DataSourceInterface> {
    throw new Error("Transactions not supported in this data source");
  }

  async transactionCommit(): Promise<void> {
    throw new Error("Transactions not supported in this data source");
  }

  async transactionRollback(): Promise<void> {
    throw new Error("Transactions not supported in this data source");
  }
}

// Mock ModelManager
class MockModelManager extends ModelManager {
  constructor() {
    super({});
  }
}

// Test patch that succeeds
class SuccessfulPatch implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Successful patch";
  dataSourceName = "db";
  updateCalled = false;

  async update(modelManager: ModelManager): Promise<void> {
    this.updateCalled = true;
  }
}

// Test patch that fails
class FailingPatch implements DatabasePatchInterface {
  version = "2024-02-05_1500";
  description = "Failing patch";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    throw new Error("Patch execution failed");
  }
}

describe("PatchExecutor", () => {
  let modelManager: MockModelManager;
  let logger: MigrationLogger;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    modelManager = new MockModelManager();
    logger = new MigrationLogger(false);
    // Spy on logger to suppress output during tests
    logSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe("executePatch", () => {
    it("should execute patch successfully with transaction", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new SuccessfulPatch();

      const result = await executor.executePatch(patch);

      expect(result.status).toBe("success");
      expect(result.version).toBe("2024-02-05_1430");
      expect(result.description).toBe("Successful patch");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(patch.updateCalled).toBe(true);

      expect(dataSource.transactionStartCalled).toBe(true);
      expect(dataSource.transactionCommitCalled).toBe(true);
      expect(dataSource.transactionRollbackCalled).toBe(false);
    });

    it("should execute patch successfully without transaction support", async () => {
      const dataSource = new MockDataSourceNoTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new SuccessfulPatch();

      const result = await executor.executePatch(patch);

      expect(result.status).toBe("success");
      expect(patch.updateCalled).toBe(true);
    });

    it("should rollback transaction on patch failure", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new FailingPatch();

      const result = await executor.executePatch(patch);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Patch execution failed");

      expect(dataSource.transactionStartCalled).toBe(true);
      expect(dataSource.transactionCommitCalled).toBe(false);
      expect(dataSource.transactionRollbackCalled).toBe(true);
    });

    it("should handle patch failure without transaction support", async () => {
      const dataSource = new MockDataSourceNoTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new FailingPatch();

      const result = await executor.executePatch(patch);

      expect(result.status).toBe("failed");
      expect(result.error?.message).toBe("Patch execution failed");
    });

    it("should skip patch in dry-run mode", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource as DataSourceInterface,
        logger,
        true, // dry-run
      );
      const patch = new SuccessfulPatch();

      const result = await executor.executePatch(patch);

      expect(result.status).toBe("skipped");
      expect(patch.updateCalled).toBe(false);
      expect(dataSource.transactionStartCalled).toBe(false);
    });

    it("should capture error stack trace", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new FailingPatch();

      const result = await executor.executePatch(patch);

      expect(result.error?.stack).toBeDefined();
      expect(result.error?.stack).toContain("FailingPatch");
    });

    it("should set timestamp on result", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );
      const patch = new SuccessfulPatch();

      const before = new Date();
      const result = await executor.executePatch(patch);
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("executePatches", () => {
    it("should execute multiple patches sequentially", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );

      const patch1 = new SuccessfulPatch();
      patch1.version = "2024-02-05_1430";
      const patch2 = new SuccessfulPatch();
      patch2.version = "2024-02-05_1500";

      const results = await executor.executePatches([patch1, patch2]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("success");
      expect(results[0].version).toBe("2024-02-05_1430");
      expect(results[1].status).toBe("success");
      expect(results[1].version).toBe("2024-02-05_1500");
    });

    it("should stop on first error by default", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );

      const patch1 = new SuccessfulPatch();
      const patch2 = new FailingPatch();
      const patch3 = new SuccessfulPatch();
      patch3.version = "2024-02-05_1600";

      const results = await executor.executePatches([patch1, patch2, patch3]);

      expect(results).toHaveLength(2); // Should stop after patch2
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("failed");
    });

    it("should continue on error when stopOnError is false", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );

      const patch1 = new SuccessfulPatch();
      const patch2 = new FailingPatch();
      const patch3 = new SuccessfulPatch();
      patch3.version = "2024-02-05_1600";

      const results = await executor.executePatches(
        [patch1, patch2, patch3],
        false,
      );

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("failed");
      expect(results[2].status).toBe("success");
    });

    it("should handle empty patches array", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource,
        logger,
        false,
      );

      const results = await executor.executePatches([]);

      expect(results).toEqual([]);
    });

    it("should skip all patches in dry-run mode", async () => {
      const dataSource = new MockDataSourceWithTransactions();
      const executor = new PatchExecutor(
        modelManager,
        dataSource as DataSourceInterface,
        logger,
        true, // dry-run
      );

      const patch1 = new SuccessfulPatch();
      const patch2 = new SuccessfulPatch();
      patch2.version = "2024-02-05_1500";

      const results = await executor.executePatches([patch1, patch2]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("skipped");
      expect(results[1].status).toBe("skipped");
    });
  });
});
