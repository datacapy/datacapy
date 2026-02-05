import * as path from "path";
import { PatchScanner } from "./patch-scanner";

describe("PatchScanner", () => {
  const fixturesPath = path.join(
    __dirname,
    "..",
    "__tests__",
    "fixtures",
    "sample-patches",
  );

  describe("scanPatches", () => {
    it("should discover and load all valid patches", async () => {
      const scanner = new PatchScanner(fixturesPath);

      const patches = await scanner.scanPatches();

      expect(patches).toHaveLength(4);
      expect(patches[0].version).toBe("2024-01-15_1200");
      expect(patches[1].version).toBe("2024-01-20_1430");
      expect(patches[2].version).toBe("2024-02-05_1430");
      expect(patches[3].version).toBe("2024-02-10_0900");
    });

    it("should return patches sorted by version", async () => {
      const scanner = new PatchScanner(fixturesPath);

      const patches = await scanner.scanPatches();

      // Verify chronological order
      for (let i = 1; i < patches.length; i++) {
        expect(patches[i].version > patches[i - 1].version).toBe(true);
      }
    });

    it("should load patch metadata correctly", async () => {
      const scanner = new PatchScanner(fixturesPath);

      const patches = await scanner.scanPatches();
      const firstPatch = patches[0];

      expect(firstPatch.version).toBe("2024-01-15_1200");
      expect(firstPatch.patch.description).toBe("Add users table");
      expect(firstPatch.patch.dataSourceName).toBe("db");
      expect(typeof firstPatch.patch.update).toBe("function");
      expect(firstPatch.filePath).toContain(
        "2024-01-15_1200_add-users-table.ts",
      );
    });

    it("should load patches with different datasource names", async () => {
      const scanner = new PatchScanner(fixturesPath);

      const patches = await scanner.scanPatches();

      const dbPatches = patches.filter((p) => p.patch.dataSourceName === "db");
      const projectPatches = patches.filter(
        (p) => p.patch.dataSourceName === "project",
      );

      expect(dbPatches).toHaveLength(3);
      expect(projectPatches).toHaveLength(1);
      expect(projectPatches[0].version).toBe("2024-02-10_0900");
    });

    it("should throw error if patch directory does not exist", async () => {
      const scanner = new PatchScanner("/nonexistent/path");

      await expect(scanner.scanPatches()).rejects.toThrow(
        "Patch directory does not exist",
      );
    });

    it("should skip files without valid extensions", async () => {
      // Create a temporary text file
      const fs = require("fs");
      const testPath = path.join(fixturesPath, "2024", "01", "readme.txt");

      fs.writeFileSync(testPath, "This is a readme file");

      try {
        const scanner = new PatchScanner(fixturesPath);
        const patches = await scanner.scanPatches();

        // Should still only find the 4 valid patches
        expect(patches).toHaveLength(4);
      } finally {
        // Clean up
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
    });

    it("should throw error for invalid filename format", async () => {
      const invalidPath = path.join(fixturesPath, "invalid");
      const scanner = new PatchScanner(invalidPath);

      await expect(scanner.scanPatches()).rejects.toThrow(
        "Invalid patch filename format",
      );
    });

    it("should handle empty patch directory", async () => {
      const fs = require("fs");
      const emptyPath = path.join(fixturesPath, "..", "empty-patches");

      // Create empty directory
      if (!fs.existsSync(emptyPath)) {
        fs.mkdirSync(emptyPath, { recursive: true });
      }

      try {
        const scanner = new PatchScanner(emptyPath);
        const patches = await scanner.scanPatches();

        expect(patches).toEqual([]);
      } finally {
        // Clean up
        if (fs.existsSync(emptyPath)) {
          fs.rmdirSync(emptyPath);
        }
      }
    });
  });

  describe("patch validation", () => {
    it("should validate patch has all required properties", async () => {
      const fs = require("fs");
      const invalidPath = path.join(fixturesPath, "..", "temp-invalid");
      const yearPath = path.join(invalidPath, "2024", "01");

      // Create directory
      fs.mkdirSync(yearPath, { recursive: true });

      // Create patch missing required property
      const patchPath = path.join(yearPath, "2024-01-01_1200_invalid-patch.ts");
      fs.writeFileSync(
        patchPath,
        `
        export default class InvalidPatch {
          version = '2024-01-01_1200'
          // Missing description, dataSourceName, and update
        }
      `,
      );

      try {
        const scanner = new PatchScanner(invalidPath);

        await expect(scanner.scanPatches()).rejects.toThrow(
          "missing required property",
        );
      } finally {
        // Clean up
        fs.unlinkSync(patchPath);
        fs.rmdirSync(yearPath);
        fs.rmdirSync(path.join(invalidPath, "2024"));
        fs.rmdirSync(invalidPath);
      }
    });

    it("should validate version format", async () => {
      const fs = require("fs");
      const invalidPath = path.join(fixturesPath, "..", "temp-invalid-version");
      const yearPath = path.join(invalidPath, "2024", "01");

      fs.mkdirSync(yearPath, { recursive: true });

      const patchPath = path.join(yearPath, "2024-01-01_1200_bad-version.ts");
      fs.writeFileSync(
        patchPath,
        `
        import { DatabasePatchInterface } from '../../../../../interface/database-patch'
        import { ModelManager } from 'mzen-om'

        export default class BadVersion implements DatabasePatchInterface {
          version = 'invalid-version'
          description = 'Test'
          dataSourceName = 'db'
          async update(modelManager: ModelManager): Promise<void> {}
        }
      `,
      );

      try {
        const scanner = new PatchScanner(invalidPath);

        await expect(scanner.scanPatches()).rejects.toThrow(
          "invalid version format",
        );
      } finally {
        fs.unlinkSync(patchPath);
        fs.rmdirSync(yearPath);
        fs.rmdirSync(path.join(invalidPath, "2024"));
        fs.rmdirSync(invalidPath);
      }
    });

    it("should validate version matches filename", async () => {
      const fs = require("fs");
      const invalidPath = path.join(
        fixturesPath,
        "..",
        "temp-version-mismatch",
      );
      const yearPath = path.join(invalidPath, "2024", "01");

      fs.mkdirSync(yearPath, { recursive: true });

      const patchPath = path.join(yearPath, "2024-01-01_1200_mismatch.ts");
      fs.writeFileSync(
        patchPath,
        `
        import { DatabasePatchInterface } from '../../../../../interface/database-patch'
        import { ModelManager } from 'mzen-om'

        export default class VersionMismatch implements DatabasePatchInterface {
          version = '2024-01-01_1300' // Different from filename
          description = 'Test'
          dataSourceName = 'db'
          async update(modelManager: ModelManager): Promise<void> {}
        }
      `,
      );

      try {
        const scanner = new PatchScanner(invalidPath);

        await expect(scanner.scanPatches()).rejects.toThrow("Version mismatch");
      } finally {
        fs.unlinkSync(patchPath);
        fs.rmdirSync(yearPath);
        fs.rmdirSync(path.join(invalidPath, "2024"));
        fs.rmdirSync(invalidPath);
      }
    });
  });
});
