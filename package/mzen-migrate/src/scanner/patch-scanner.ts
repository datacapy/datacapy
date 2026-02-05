import * as fs from "fs";
import * as path from "path";
import { DatabasePatchInterface } from "../interface/database-patch";
import { PatchFile } from "../interface/migration-result";

/**
 * PatchScanner
 *
 * Discovers and loads migration patch files from the filesystem.
 * Expected directory structure: patchDir/YYYY/MM/YYYY-MM-DD_HHMM_label.(ts|tsx|js)
 */
export class PatchScanner {
  private patchDirectory: string;

  constructor(patchDirectory: string) {
    this.patchDirectory = path.resolve(patchDirectory);
  }

  /**
   * Scan directory for patch files
   *
   * @returns Array of loaded patch files sorted by version
   * @throws Error if patch directory doesn't exist or patches are invalid
   */
  async scanPatches(): Promise<PatchFile[]> {
    // Check if patch directory exists
    if (!fs.existsSync(this.patchDirectory)) {
      throw new Error(`Patch directory does not exist: ${this.patchDirectory}`);
    }

    const patchFiles: PatchFile[] = [];

    // Scan YYYY directories
    const yearDirs = this.getDirectories(this.patchDirectory);

    for (const yearDir of yearDirs) {
      // Skip non-year directories (must be 4 digits)
      if (!/^\d{4}$/.test(yearDir)) {
        continue;
      }

      const yearPath = path.join(this.patchDirectory, yearDir);
      const monthDirs = this.getDirectories(yearPath);

      for (const monthDir of monthDirs) {
        // Skip non-month directories (must be 2 digits)
        if (!/^\d{2}$/.test(monthDir)) {
          continue;
        }

        const monthPath = path.join(yearPath, monthDir);
        const files = this.getFiles(monthPath);

        for (const file of files) {
          const filePath = path.join(monthPath, file);
          const patchFile = await this.loadPatchFile(filePath);

          if (patchFile) {
            patchFiles.push(patchFile);
          }
        }
      }
    }

    // Sort by version
    patchFiles.sort((a, b) => a.version.localeCompare(b.version));

    return patchFiles;
  }

  /**
   * Load and validate a single patch file
   *
   * @param filePath - Absolute path to patch file
   * @returns PatchFile if valid, null if should be skipped
   */
  private async loadPatchFile(filePath: string): Promise<PatchFile | null> {
    const fileName = path.basename(filePath);

    // Check file extension (must be .ts, .tsx, or .js)
    const ext = path.extname(fileName);
    if (![".ts", ".tsx", ".js"].includes(ext)) {
      return null;
    }

    // Extract version from filename
    const versionMatch = fileName.match(/^(\d{4}-\d{2}-\d{2}_\d{4})_/);
    if (!versionMatch) {
      throw new Error(
        `Invalid patch filename format: ${fileName}. Expected format: YYYY-MM-DD_HHMM_label.(ts|tsx|js)`,
      );
    }

    const version = versionMatch[1];

    // Load the patch module
    let patchModule: any;
    try {
      // Clear require cache to ensure fresh load (important for testing)
      delete require.cache[require.resolve(filePath)];

      patchModule = require(filePath);
    } catch (error) {
      throw new Error(`Failed to load patch file ${filePath}: ${error}`);
    }

    // Get the default export (patch class)
    const PatchClass = patchModule.default || patchModule;

    if (!PatchClass) {
      throw new Error(`Patch file ${filePath} has no default export`);
    }

    // Instantiate the patch
    let patch: any;
    try {
      patch = new PatchClass();
    } catch (error) {
      throw new Error(
        `Failed to instantiate patch class from ${filePath}: ${error}`,
      );
    }

    // Validate patch implements DatabasePatchInterface
    this.validatePatch(patch, filePath);

    // Validate version matches filename
    if (patch.version !== version) {
      throw new Error(
        `Version mismatch in ${filePath}: filename version "${version}" does not match class version "${patch.version}"`,
      );
    }

    return {
      version,
      filePath,
      patch,
    };
  }

  /**
   * Validate patch implements DatabasePatchInterface
   */
  private validatePatch(patch: any, filePath: string): void {
    const requiredProps: (keyof DatabasePatchInterface)[] = [
      "version",
      "description",
      "dataSourceName",
      "update",
    ];

    for (const prop of requiredProps) {
      if (!(prop in patch)) {
        throw new Error(
          `Patch ${filePath} is missing required property: ${prop}`,
        );
      }
    }

    // Validate types
    if (typeof patch.version !== "string") {
      throw new Error(`Patch ${filePath}: version must be a string`);
    }

    if (typeof patch.description !== "string") {
      throw new Error(`Patch ${filePath}: description must be a string`);
    }

    if (typeof patch.dataSourceName !== "string") {
      throw new Error(`Patch ${filePath}: dataSourceName must be a string`);
    }

    if (typeof patch.update !== "function") {
      throw new Error(`Patch ${filePath}: update must be a function`);
    }

    // Validate version format
    const versionRegex = /^\d{4}-\d{2}-\d{2}_\d{4}$/;
    if (!versionRegex.test(patch.version)) {
      throw new Error(
        `Patch ${filePath}: invalid version format "${patch.version}". Expected YYYY-MM-DD_HHMM`,
      );
    }
  }

  /**
   * Get subdirectories in a directory
   */
  private getDirectories(dirPath: string): string[] {
    try {
      return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get files in a directory
   */
  private getFiles(dirPath: string): string[] {
    try {
      return fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name);
    } catch (error) {
      return [];
    }
  }
}
