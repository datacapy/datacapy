import { DatabasePatchInterface } from "../../../../../interface/database-patch";
import { ModelManager } from "mzen-om";

export default class ProjectDatasourcePatch implements DatabasePatchInterface {
  version = "2024-02-10_0900";
  description = "Patch for project datasource";
  dataSourceName = "project";

  async update(modelManager: ModelManager): Promise<void> {
    console.log("Updating project datasource");
  }
}
