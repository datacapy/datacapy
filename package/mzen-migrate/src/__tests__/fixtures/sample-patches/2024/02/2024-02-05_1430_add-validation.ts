import { DatabasePatchInterface } from "../../../../../interface/database-patch";
import { ModelManager } from "mzen-om";

export default class AddValidation implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Add email validation";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    console.log("Adding validation");
  }
}
