/**
 * VersionManager
 *
 * Stateless utility for version operations.
 * Handles version parsing, comparison, sorting, and validation.
 * Version format: YYYY-MM-DD_HHMM (e.g., "2024-02-05_1430")
 */
export class VersionManager {
  /**
   * Version format regex: YYYY-MM-DD_HHMM
   */
  private static readonly VERSION_REGEX = /^\d{4}-\d{2}-\d{2}_\d{4}$/;

  /**
   * Parse version string to timestamp
   *
   * @param version - Version string in format YYYY-MM-DD_HHMM
   * @returns Timestamp in milliseconds
   * @throws Error if version format is invalid
   */
  static parseVersion(version: string): number {
    // Handle special sentinel value for "no patches applied"
    if (version === "0000-00-00_0000") {
      return 0;
    }

    if (!this.isValidVersion(version)) {
      throw new Error(
        `Invalid version format: ${version}. Expected YYYY-MM-DD_HHMM`,
      );
    }

    // Extract date and time parts
    const [datePart, timePart] = version.split("_");
    const [year, month, day] = datePart.split("-").map(Number);
    const hours = parseInt(timePart.substring(0, 2), 10);
    const minutes = parseInt(timePart.substring(2, 4), 10);

    // Create Date object (months are 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

    // Validate the date is valid (catches invalid dates like 2024-02-30)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hours ||
      date.getMinutes() !== minutes
    ) {
      throw new Error(`Invalid date in version: ${version}`);
    }

    return date.getTime();
  }

  /**
   * Compare two versions
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  static compareVersions(v1: string, v2: string): number {
    const t1 = this.parseVersion(v1);
    const t2 = this.parseVersion(v2);

    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
  }

  /**
   * Sort versions in ascending chronological order
   *
   * @param versions - Array of version strings
   * @returns Sorted array (new array, original not modified)
   */
  static sortVersions(versions: string[]): string[] {
    return [...versions].sort((a, b) => this.compareVersions(a, b));
  }

  /**
   * Get versions to apply based on current and target version
   *
   * @param allVersions - All available patch versions
   * @param currentVersion - Current database version (default: "0000-00-00_0000")
   * @param targetVersion - Target version (default: latest)
   * @returns Array of versions to apply (sorted chronologically)
   */
  static getVersionsToApply(
    allVersions: string[],
    currentVersion: string = "0000-00-00_0000",
    targetVersion?: string,
  ): string[] {
    const sorted = this.sortVersions(allVersions);

    // Filter versions after current version
    const afterCurrent = sorted.filter(
      (v) => this.compareVersions(v, currentVersion) > 0,
    );

    // If no target specified, return all after current
    if (!targetVersion) {
      return afterCurrent;
    }

    // Filter versions up to and including target
    return afterCurrent.filter(
      (v) => this.compareVersions(v, targetVersion) <= 0,
    );
  }

  /**
   * Validate version format
   *
   * @param version - Version string to validate
   * @returns True if valid format
   */
  static isValidVersion(version: string): boolean {
    // Special sentinel value for "no patches applied"
    if (version === "0000-00-00_0000") {
      return true;
    }

    if (!this.VERSION_REGEX.test(version)) {
      return false;
    }

    // Additional validation: check if date components are valid
    try {
      const [datePart, timePart] = version.split("_");
      const [year, month, day] = datePart.split("-").map(Number);
      const hours = parseInt(timePart.substring(0, 2), 10);
      const minutes = parseInt(timePart.substring(2, 4), 10);

      // Create Date object (months are 0-indexed in JavaScript)
      const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

      // Validate the date is valid (catches invalid dates like 2024-02-30)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hours ||
        date.getMinutes() !== minutes
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate version string for current time
   *
   * @param date - Optional date (default: now)
   * @returns Version string in format YYYY-MM-DD_HHMM
   */
  static generateVersion(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}_${hours}${minutes}`;
  }

  /**
   * Get the latest version from an array of versions
   *
   * @param versions - Array of version strings
   * @returns Latest version or undefined if array is empty
   */
  static getLatestVersion(versions: string[]): string | undefined {
    if (versions.length === 0) {
      return undefined;
    }

    const sorted = this.sortVersions(versions);
    return sorted[sorted.length - 1];
  }
}
