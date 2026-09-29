import { VersionManager } from "./version-manager";

describe("VersionManager", () => {
  describe("isValidVersion", () => {
    it("should validate correct version formats", () => {
      expect(VersionManager.isValidVersion("2024-02-05_1430")).toBe(true);
      expect(VersionManager.isValidVersion("2024-01-01_0000")).toBe(true);
      expect(VersionManager.isValidVersion("2024-12-31_2359")).toBe(true);
    });

    it("should reject invalid version formats", () => {
      expect(VersionManager.isValidVersion("2024-2-5_1430")).toBe(false);
      expect(VersionManager.isValidVersion("24-02-05_1430")).toBe(false);
      expect(VersionManager.isValidVersion("2024-02-05_143")).toBe(false);
      expect(VersionManager.isValidVersion("2024-02-05 1430")).toBe(false);
      expect(VersionManager.isValidVersion("2024-02-05")).toBe(false);
      expect(VersionManager.isValidVersion("invalid")).toBe(false);
    });

    it("should reject invalid dates", () => {
      expect(VersionManager.isValidVersion("2024-02-30_1430")).toBe(false);
      expect(VersionManager.isValidVersion("2024-13-01_1430")).toBe(false);
      expect(VersionManager.isValidVersion("2024-00-01_1430")).toBe(false);
      expect(VersionManager.isValidVersion("2024-02-05_2500")).toBe(false);
      expect(VersionManager.isValidVersion("2024-02-05_1260")).toBe(false);
    });
  });

  describe("parseVersion", () => {
    it("should parse valid versions to timestamps", () => {
      const version = "2024-02-05_1430";
      const timestamp = VersionManager.parseVersion(version);
      const date = new Date(timestamp);

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(1); // February (0-indexed)
      expect(date.getDate()).toBe(5);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
    });

    it("should throw error for invalid format", () => {
      expect(() => VersionManager.parseVersion("invalid")).toThrow(
        "Invalid version format",
      );
      expect(() => VersionManager.parseVersion("2024-02-05")).toThrow(
        "Invalid version format",
      );
    });

    it("should throw error for invalid dates", () => {
      expect(() => VersionManager.parseVersion("2024-02-30_1430")).toThrow(
        "Invalid version format",
      );
    });
  });

  describe("compareVersions", () => {
    it("should compare versions correctly", () => {
      expect(
        VersionManager.compareVersions("2024-02-05_1430", "2024-02-05_1430"),
      ).toBe(0);
      expect(
        VersionManager.compareVersions("2024-02-05_1430", "2024-02-05_1500"),
      ).toBe(-1);
      expect(
        VersionManager.compareVersions("2024-02-05_1500", "2024-02-05_1430"),
      ).toBe(1);
      expect(
        VersionManager.compareVersions("2024-02-05_1430", "2024-02-06_1430"),
      ).toBe(-1);
      expect(
        VersionManager.compareVersions("2024-02-06_1430", "2024-02-05_1430"),
      ).toBe(1);
      expect(
        VersionManager.compareVersions("2024-01-31_2359", "2024-02-01_0000"),
      ).toBe(-1);
    });
  });

  describe("sortVersions", () => {
    it("should sort versions in ascending order", () => {
      const versions = [
        "2024-02-05_1500",
        "2024-02-05_1430",
        "2024-02-06_1430",
        "2024-01-15_1200",
      ];

      const sorted = VersionManager.sortVersions(versions);

      expect(sorted).toEqual([
        "2024-01-15_1200",
        "2024-02-05_1430",
        "2024-02-05_1500",
        "2024-02-06_1430",
      ]);
    });

    it("should not modify original array", () => {
      const versions = ["2024-02-05_1500", "2024-02-05_1430"];
      const original = [...versions];

      VersionManager.sortVersions(versions);

      expect(versions).toEqual(original);
    });

    it("should handle empty array", () => {
      expect(VersionManager.sortVersions([])).toEqual([]);
    });

    it("should handle single version", () => {
      expect(VersionManager.sortVersions(["2024-02-05_1430"])).toEqual([
        "2024-02-05_1430",
      ]);
    });
  });

  describe("getVersionsToApply", () => {
    const allVersions = [
      "2024-01-15_1200",
      "2024-02-05_1430",
      "2024-02-05_1500",
      "2024-02-06_1430",
      "2024-03-01_1000",
    ];

    it("should return all versions after current when no target specified", () => {
      const result = VersionManager.getVersionsToApply(
        allVersions,
        "2024-02-05_1430",
      );

      expect(result).toEqual([
        "2024-02-05_1500",
        "2024-02-06_1430",
        "2024-03-01_1000",
      ]);
    });

    it("should return versions between current and target", () => {
      const result = VersionManager.getVersionsToApply(
        allVersions,
        "2024-01-15_1200",
        "2024-02-05_1500",
      );

      expect(result).toEqual(["2024-02-05_1430", "2024-02-05_1500"]);
    });

    it("should return all versions when current is default", () => {
      const result = VersionManager.getVersionsToApply(allVersions);

      expect(result).toEqual(allVersions);
    });

    it("should return empty array when current is latest", () => {
      const result = VersionManager.getVersionsToApply(
        allVersions,
        "2024-03-01_1000",
      );

      expect(result).toEqual([]);
    });

    it("should handle empty versions array", () => {
      const result = VersionManager.getVersionsToApply([], "2024-02-05_1430");

      expect(result).toEqual([]);
    });

    it("should include target version if it exists", () => {
      const result = VersionManager.getVersionsToApply(
        allVersions,
        "2024-02-05_1430",
        "2024-02-06_1430",
      );

      expect(result).toEqual(["2024-02-05_1500", "2024-02-06_1430"]);
    });
  });

  describe("generateVersion", () => {
    it("should generate version for current time", () => {
      const version = VersionManager.generateVersion();

      expect(VersionManager.isValidVersion(version)).toBe(true);
    });

    it("should generate version for specific date", () => {
      const date = new Date(2024, 1, 5, 14, 30); // February 5, 2024, 14:30
      const version = VersionManager.generateVersion(date);

      expect(version).toBe("2024-02-05_1430");
    });

    it("should pad single digits", () => {
      const date = new Date(2024, 0, 5, 9, 5); // January 5, 2024, 09:05
      const version = VersionManager.generateVersion(date);

      expect(version).toBe("2024-01-05_0905");
    });
  });

  describe("getLatestVersion", () => {
    it("should return latest version from array", () => {
      const versions = [
        "2024-01-15_1200",
        "2024-02-05_1430",
        "2024-02-05_1500",
        "2024-02-06_1430",
      ];

      expect(VersionManager.getLatestVersion(versions)).toBe("2024-02-06_1430");
    });

    it("should handle unsorted array", () => {
      const versions = [
        "2024-02-06_1430",
        "2024-01-15_1200",
        "2024-02-05_1500",
      ];

      expect(VersionManager.getLatestVersion(versions)).toBe("2024-02-06_1430");
    });

    it("should return undefined for empty array", () => {
      expect(VersionManager.getLatestVersion([])).toBeUndefined();
    });

    it("should handle single version", () => {
      expect(VersionManager.getLatestVersion(["2024-02-05_1430"])).toBe(
        "2024-02-05_1430",
      );
    });
  });
});
