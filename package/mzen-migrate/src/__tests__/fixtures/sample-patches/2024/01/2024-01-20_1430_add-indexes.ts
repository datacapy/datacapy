import { DatabasePatchInterface } from "../../../../../interface/database-patch";
import { ModelManager } from "mzen-om";

export default class AddIndexes implements DatabasePatchInterface {
  version = "2024-01-20_1430";
  description = "Add database indexes";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    console.log("Adding indexes");
  }
}
