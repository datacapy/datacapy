import { DataSourceInterface } from "@datacapy/om/dist/data-source";
import { genUniqueId } from "@datacapy/id";

/**
 * MetaRecord
 *
 * Schema for migration meta table records
 */
export interface MetaRecord {
  _id?: string;
  version: string;
  description: string;
  appliedAt: Date;
  duration?: number;
}

/**
 * MetaTable
 *
 * Manages the migration metadata table for tracking applied patches.
 * Stores records in the target datasource to track which migrations have been applied.
 */
export class MetaTable {
  private dataSource: DataSourceInterface;
  private tableName: string;

  constructor(
    dataSource: DataSourceInterface,
    tableName: string = "migrationMeta",
  ) {
    this.dataSource = dataSource;
    this.tableName = tableName;
  }

  /**
   * Initialize meta table if it doesn't exist
   * Checks if table exists by attempting to count records
   */
  async initialize(): Promise<void> {
    try {
      // Try to count records - if table doesn't exist, this will fail
      await this.dataSource.count(this.tableName);
    } catch (error) {
      // Table doesn't exist, create it by inserting a dummy record and removing it
      // This works for both MySQL and MongoDB datasources
      const dummyRecord: MetaRecord = {
        _id: genUniqueId(),
        version: "0000-00-00_0000",
        description: "Initial meta table creation",
        appliedAt: new Date(),
      };

      try {
        await this.dataSource.insertOne(this.tableName, dummyRecord);
        await this.dataSource.deleteOne(this.tableName, {
          version: "0000-00-00_0000",
        });
      } catch (insertError) {
        // If insertion fails, table might have been created by another process
        // Check if we can now count records
        try {
          await this.dataSource.count(this.tableName);
        } catch {
          // Still can't access table, re-throw the original error
          throw new Error(`Failed to initialize meta table: ${insertError}`);
        }
      }
    }

    // Create index on version field for efficient lookups
    try {
      await this.dataSource.createIndex(
        this.tableName,
        { version: 1 },
        { name: "idx_migration_version", unique: true },
      );
    } catch (error) {
      // Index might already exist, ignore error
    }

    // Create index on appliedAt for chronological queries
    try {
      await this.dataSource.createIndex(
        this.tableName,
        { appliedAt: -1 },
        { name: "idx_migration_appliedAt" },
      );
    } catch (error) {
      // Index might already exist, ignore error
    }
  }

  /**
   * Get current database version (latest applied patch by version number)
   * Returns "0000-00-00_0000" if no patches have been applied
   */
  async getCurrentVersion(): Promise<string> {
    const records = (await this.dataSource.find(
      this.tableName,
      {},
    )) as MetaRecord[];

    if (records.length === 0) {
      return "0000-00-00_0000";
    }

    // Sort by version string (chronological order) and return latest
    const sorted = records.sort((a, b) => b.version.localeCompare(a.version));
    return sorted[0].version;
  }

  /**
   * Record a successfully applied patch
   */
  async recordPatch(
    version: string,
    description: string,
    duration?: number,
  ): Promise<void> {
    const record: MetaRecord = {
      _id: genUniqueId(),
      version,
      description,
      appliedAt: new Date(),
      duration,
    };

    await this.dataSource.insertOne(this.tableName, record);
  }

  /**
   * Get all applied patches in chronological order
   */
  async getAppliedPatches(): Promise<MetaRecord[]> {
    const records = await this.dataSource.find(
      this.tableName,
      {},
      {
        sort: { appliedAt: 1 },
      },
    );
    return records as MetaRecord[];
  }

  /**
   * Check if a specific patch has been applied
   */
  async isPatchApplied(version: string): Promise<boolean> {
    const count = await this.dataSource.count(this.tableName, { version });
    return count > 0;
  }

  /**
   * Get the number of applied patches
   */
  async getAppliedPatchCount(): Promise<number> {
    return this.dataSource.count(this.tableName);
  }

  /**
   * Delete a patch record (for testing or manual correction)
   * WARNING: Use with caution
   */
  async deletePatchRecord(version: string): Promise<void> {
    await this.dataSource.deleteOne(this.tableName, { version });
  }

  /**
   * Clear all patch records (for testing)
   * WARNING: Use with extreme caution
   */
  async clearAll(): Promise<void> {
    await this.dataSource.deleteMany(this.tableName, {});
  }
}
