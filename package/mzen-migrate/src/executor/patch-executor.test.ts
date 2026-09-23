import { PatchExecutor } from "./patch-executor";
import { DatabasePatchInterface } from "../interface/database-patch";
import { MigrationLogger } from "../logger/migration-logger";
import { ModelManager, DataSourceContext } from "mzen-om";

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
  receivedContext: DataSourceContext | undefined;

  async update(
    modelManager: ModelManager,
    context: DataSourceContext,
  ): Promise<void> {
    this.updateCalled = true;
    this.receivedContext = context;
  }
}

// Test patch that fails
class FailingPatch implements DatabasePatchInterface {
  version = "2024-02-05_1500";
  description = "Failing patch";
  dataSourceName = "db";

  async update(): Promise<void> {
    throw new Error("Patch execution failed");
  }
}

describe("PatchExecutor", () => {
  let modelManager: MockModelManager;
  let logger: MigrationLogger;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let context: DataSourceContext;

  beforeEach(() => {
    modelManager = new MockModelManager();
    logger = new MigrationLogger(false);
    context = new DataSourceContext();
    // MigrationLogger prints to console by design (it's a CLI logger) - suppress its
    // output during tests, matching its info/warn/error levels.
    logSpy = jest.spyOn(console, "log").mockImplementation();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("executePatch", () => {
    it("should execute patch successfully", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);
      const patch = new SuccessfulPatch();

      const result = await executor.executePatch(patch, context);

      expect(result.status).toBe("success");
      expect(result.version).toBe("2024-02-05_1430");
      expect(result.description).toBe("Successful patch");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(patch.updateCalled).toBe(true);
    });

    it("should pass the DataSourceContext through to the patch", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);
      const patch = new SuccessfulPatch();

      await executor.executePatch(patch, context);

      expect(patch.receivedContext).toBe(context);
    });

    it("should report failure when the patch throws", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);
      const patch = new FailingPatch();

      const result = await executor.executePatch(patch, context);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Patch execution failed");
    });

    it("should skip patch in dry-run mode", async () => {
      const executor = new PatchExecutor(modelManager, logger, true);
      const patch = new SuccessfulPatch();

      const result = await executor.executePatch(patch, context);

      expect(result.status).toBe("skipped");
      expect(patch.updateCalled).toBe(false);
    });

    it("should capture error stack trace", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);
      const patch = new FailingPatch();

      const result = await executor.executePatch(patch, context);

      expect(result.error?.stack).toBeDefined();
      expect(result.error?.stack).toContain("FailingPatch");
    });

    it("should set timestamp on result", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);
      const patch = new SuccessfulPatch();

      const before = new Date();
      const result = await executor.executePatch(patch, context);
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("executePatches", () => {
    it("should execute multiple patches sequentially", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);

      const patch1 = new SuccessfulPatch();
      patch1.version = "2024-02-05_1430";
      const patch2 = new SuccessfulPatch();
      patch2.version = "2024-02-05_1500";

      const results = await executor.executePatches([patch1, patch2], context);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("success");
      expect(results[0].version).toBe("2024-02-05_1430");
      expect(results[1].status).toBe("success");
      expect(results[1].version).toBe("2024-02-05_1500");
    });

    it("should stop on first error by default", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);

      const patch1 = new SuccessfulPatch();
      const patch2 = new FailingPatch();
      const patch3 = new SuccessfulPatch();
      patch3.version = "2024-02-05_1600";

      const results = await executor.executePatches(
        [patch1, patch2, patch3],
        context,
      );

      expect(results).toHaveLength(2); // Should stop after patch2
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("failed");
    });

    it("should continue on error when stopOnError is false", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);

      const patch1 = new SuccessfulPatch();
      const patch2 = new FailingPatch();
      const patch3 = new SuccessfulPatch();
      patch3.version = "2024-02-05_1600";

      const results = await executor.executePatches(
        [patch1, patch2, patch3],
        context,
        false,
      );

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("failed");
      expect(results[2].status).toBe("success");
    });

    it("should handle empty patches array", async () => {
      const executor = new PatchExecutor(modelManager, logger, false);

      const results = await executor.executePatches([], context);

      expect(results).toEqual([]);
    });

    it("should skip all patches in dry-run mode", async () => {
      const executor = new PatchExecutor(modelManager, logger, true);

      const patch1 = new SuccessfulPatch();
      const patch2 = new SuccessfulPatch();
      patch2.version = "2024-02-05_1500";

      const results = await executor.executePatches([patch1, patch2], context);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("skipped");
      expect(results[1].status).toBe("skipped");
    });
  });
});
