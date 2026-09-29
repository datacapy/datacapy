import { DatabasePatchInterface } from "../../../../../interface/database-patch";
import { ModelManager } from "@datacapy/om";

export default class AddUsersTable implements DatabasePatchInterface {
  version = "2024-01-15_1200";
  description = "Add users table";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    // Test implementation
    console.log("Adding users table");
  }
}
