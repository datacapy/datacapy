import { DatabasePatchInterface } from "../../../../../interface/database-patch";
import { ModelManager } from "@datacapy/om";

export default class WorkspaceDatasourcePatch implements DatabasePatchInterface {
  version = "2024-02-10_0900";
  description = "Patch for workspace datasource";
  dataSourceName = "workspace";

  async update(modelManager: ModelManager): Promise<void> {
    console.log("Updating workspace datasource");
  }
}
